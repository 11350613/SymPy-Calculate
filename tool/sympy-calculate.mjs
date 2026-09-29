/**
 * `sympy_calculate` - the stateless SymPy tool of the `sympy-calculate`
 * agent preset.
 *
 * This file ships inside the preset directory and imports nothing but Node
 * builtins. Each call starts a fresh Python process whose cwd and PYTHONPATH
 * point at the local SymPy development checkout, so no state survives between
 * calls and no path setup belongs in the model prompt.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Cordis plugin name. */
export const name = 'tool-sympy-calculate'

/** The `tools` registry is a host service; this row only registers into it. */
export const inject = ['tools']

/** Wall-clock budget for one evaluation, in milliseconds. */
const DEFAULT_TIMEOUT_MS = 120_000

/** Result and diagnostic text longer than this is truncated. */
const MAX_RESULT_CHARS = 20_000

/** The tool's model-facing description. */
const DESCRIPTION = [
  'Run a complete Python script using the local SymPy development checkout.',
  'Each call runs in a fresh Python process.',
  'Use this tool instead of bash for SymPy computations.',
].join('\n')

/** The checkout root; SYMPY_ROOT overrides the default for this host. */
function resolveRoot() {
  const configured = process.env.SYMPY_ROOT
  if (configured !== undefined && configured.trim() !== '') return configured.trim()
  return join(homedir(), 'sympy-dev', 'sympy')
}

/** Candidate Python interpreters, most specific first. */
function candidatePythons(root) {
  const list = []
  const explicit = process.env.SYMPY_PYTHON
  if (explicit !== undefined && explicit !== '') list.push(explicit)
  list.push(join(root, 'venv', 'bin', 'python'))
  list.push(join(root, 'venv', 'bin', 'python3'))
  return list
}

/** The first candidate that exists, or undefined when none does. */
function resolvePython(root) {
  for (const candidate of candidatePythons(root)) {
    if (!candidate.includes('/')) return candidate
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

function clamp(text, truncated = false) {
  if (!truncated && text.length <= MAX_RESULT_CHARS) return text
  return `${text.slice(0, MAX_RESULT_CHARS)}\n... (truncated at ${MAX_RESULT_CHARS} characters)`
}

function captureOutput(stream) {
  const output = { text: '', truncated: false }
  stream.on('data', (chunk) => {
    if (output.truncated) return
    const text = output.text === '' ? String(chunk).trimStart() : String(chunk)
    const remaining = MAX_RESULT_CHARS - output.text.length
    output.text += text.slice(0, remaining)
    if (text.length > remaining) output.truncated = true
  })
  return output
}

/**
 * Run one Python script in a fresh process and settle with plain output text.
 * @param code - complete Python source.
 * @param timeoutMs - wall-clock budget.
 * @param signal - optional agent cancellation signal.
 */
function runScript(code, timeoutMs, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ ok: false, error: 'sympy_calculate: cancelled' })
      return
    }

    const root = resolveRoot()
    const python = resolvePython(root)
    if (python === undefined) {
      resolve({
        ok: false,
        error: 'sympy_calculate: no Python interpreter found under the SymPy development checkout. '
          + 'Set SYMPY_ROOT or SYMPY_PYTHON in the dsh host environment.',
      })
      return
    }

    const child = spawn(python, ['-'], {
      cwd: root,
      env: { ...process.env, PYTHONPATH: root, PYTHONIOENCODING: 'utf-8' },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    })

    const stdout = captureOutput(child.stdout)
    const stderr = captureOutput(child.stderr)
    let settled = false

    const settle = (outcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (signal !== undefined) signal.removeEventListener('abort', onAbort)
      child.stdin.destroy()
      child.stdout.destroy()
      child.stderr.destroy()
      resolve(outcome)
    }

    const terminate = (error) => {
      if (settled) return
      try {
        if (child.pid !== undefined) {
          if (process.platform === 'win32') child.kill('SIGKILL')
          else process.kill(-child.pid, 'SIGKILL')
        }
      } catch (cause) {
        if (cause.code !== 'ESRCH') error += `; cannot terminate Python: ${String(cause)}`
      }
      settle({ ok: false, error })
    }

    const onAbort = () => terminate('sympy_calculate: cancelled')
    const timer = setTimeout(() => {
      terminate(`sympy_calculate: timed out after ${Math.round(timeoutMs / 1000)} seconds`)
    }, timeoutMs)

    child.stdin.on('error', () => {})

    child.on('error', (error) => {
      settle({ ok: false, error: `sympy_calculate: cannot launch Python: ${String(error)}` })
    })

    child.on('close', (exitCode, exitSignal) => {
      if (settled) return
      if (exitSignal !== null && exitCode !== 0) {
        settle({ ok: false, error: `sympy_calculate: killed by ${exitSignal}` })
        return
      }
      const stdoutText = stdout.text.trim()
      const stderrText = stderr.text.trim()
      if (exitCode !== 0) {
        const output = stderrText === '' ? stdout : stderr
        settle({
          ok: false,
          error: `sympy_calculate: exit code ${exitCode}\n${clamp(output.text.trim(), output.truncated)}`,
        })
        return
      }
      let text = stdoutText
      if (text === '') text = stderrText === '' ? '(no output)' : stderrText
      else if (stderrText !== '') text += `\n[stderr]\n${stderrText}`
      settle({ ok: true, text, truncated: stdout.truncated || stderr.truncated })
    })

    if (signal !== undefined) {
      signal.addEventListener('abort', onAbort, { once: true })
      if (signal.aborted) {
        onAbort()
        return
      }
    }

    child.stdin.end(code)
  })
}

/**
 * Register `sympy_calculate` into the calling agent's tool catalog.
 * @param ctx - the preset row's Cordis context.
 */
export function apply(ctx) {
  if (resolvePython(resolveRoot()) === undefined) {
    console.error(
      `[${name}] no Python interpreter found under the SymPy development checkout; `
      + 'sympy_calculate will report the missing checkout when called. Set SYMPY_ROOT or '
      + 'SYMPY_PYTHON in the dsh host environment.',
    )
  }

  ctx.tools.register({
    name: 'sympy_calculate',
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'A complete Python script. Include imports and print the final results.',
        },
      },
      required: ['code'],
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args, exec) {
      const code = String(args.code ?? '')
      if (code.trim() === '') throw new Error('sympy_calculate: code is empty')
      const timeoutMs = DEFAULT_TIMEOUT_MS
      const outcome = await runScript(code, timeoutMs, exec?.signal)
      if (!outcome.ok) throw new Error(outcome.error)
      return clamp(outcome.text, outcome.truncated)
    },
  })
}
