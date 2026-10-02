import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'sympy-calculate'

// The tools registry is a host service; this plugin only registers into it.
export const inject = ['tools']

// Deadline for one evaluation, imposed by the host through `exec.signal`.
const TIMEOUT_MS = 120_000

// In-process guard against runaway output; oversized model-facing results spill on their own.
const MAX_OUTPUT_CHARS = 2_000_000

const DESCRIPTION = [
  'Run a complete Python script with the local SymPy development checkout.',
  'Each call starts a fresh Python process, so nothing persists between calls.',
  'Prefer this tool over bash for SymPy computations.',
].join('\n')

function checkoutRoot() {
  const configured = process.env.SYMPY_ROOT?.trim()
  return configured === undefined || configured === '' ? join(homedir(), 'sympy-dev', 'sympy') : configured
}

function interpreter(root) {
  const candidates = [
    process.env.SYMPY_PYTHON,
    join(root, 'venv', 'bin', 'python'),
    join(root, 'venv', 'bin', 'python3'),
  ]
  return candidates.find((candidate) =>
    candidate !== undefined && candidate !== '' && (!candidate.includes('/') || existsSync(candidate)))
}

function capture(stream) {
  const sink = { text: '', truncated: false }
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    if (sink.truncated) return
    const room = MAX_OUTPUT_CHARS - sink.text.length
    if (chunk.length > room) {
      sink.text += chunk.slice(0, room)
      sink.truncated = true
    } else {
      sink.text += chunk
    }
  })
  return sink
}

function report(stdout, stderr) {
  const parts = []
  if (stdout.text.trim() !== '') parts.push(stdout.text.trim())
  if (stderr.text.trim() !== '') parts.push(`[stderr]\n${stderr.text.trim()}`)
  if (stdout.truncated || stderr.truncated) {
    parts.push(`[output truncated at ${MAX_OUTPUT_CHARS} characters]`)
  }
  return parts.join('\n')
}

function run(code, signal) {
  return new Promise((resolve) => {
    const root = checkoutRoot()
    const python = interpreter(root)
    if (python === undefined) {
      resolve({ error: `sympy_calculate: no Python interpreter under ${root}. Set SYMPY_ROOT or SYMPY_PYTHON.` })
      return
    }

    const child = spawn(python, ['-'], {
      cwd: root,
      env: { ...process.env, PYTHONPATH: root, PYTHONIOENCODING: 'utf-8' },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
    })

    const stdout = capture(child.stdout)
    const stderr = capture(child.stderr)
    let settled = false

    const kill = () => {
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        // The process group has already exited.
      }
    }

    const settle = (outcome) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      child.stdin.destroy()
      child.stdout.destroy()
      child.stderr.destroy()
      resolve(outcome)
    }

    const onAbort = () => {
      kill()
      settle({ error: 'sympy_calculate: cancelled' })
    }

    child.stdin.on('error', () => {})
    child.on('error', (error) => {
      settle({ error: `sympy_calculate: cannot launch ${python}: ${error.message}` })
    })
    child.on('close', (exitCode, exitSignal) => {
      if (exitSignal !== null) {
        settle({ error: `sympy_calculate: killed by ${exitSignal}` })
        return
      }
      const text = report(stdout, stderr)
      if (exitCode !== 0) {
        settle({ error: [`sympy_calculate: exit code ${exitCode}`, text].filter(Boolean).join('\n') })
        return
      }
      settle({ text: text === '' ? '(no output)' : text })
    })

    if (signal?.aborted === true) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    child.stdin.end(code)
  })
}

export function apply(ctx) {
  ctx.tools.register({
    name: 'sympy_calculate',
    description: DESCRIPTION,
    timeoutMs: TIMEOUT_MS,
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'A complete Python script. Include imports and print the results.',
        },
      },
      required: ['code'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const code = args?.code
      if (typeof code !== 'string' || code.trim() === '') {
        throw new Error('sympy_calculate: code must be a non-empty string')
      }
      const outcome = await run(code, exec.signal)
      if (outcome.error !== undefined) throw new Error(outcome.error)
      return outcome.text
    },
  })
}
