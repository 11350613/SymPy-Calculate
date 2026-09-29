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

function clamp(text) {
  if (text.length <= MAX_RESULT_CHARS) return text
  return `${text.slice(0, MAX_RESULT_CHARS)}\n... (truncated at ${MAX_RESULT_CHARS} characters)`
}

/**
 * Run one Python script in a fresh process and settle with plain output text.
 * @param code - complete Python source.
 * @param timeoutMs - wall-clock budget.
 * @param signal - optional agent cancellation signal.
 */
function runScript(code, timeoutMs, signal) {
  return new Promise((resolve) => {
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
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false

    const settle = (outcome) => {
      if (settled) return
      settled = true
      resolve(outcome)
    }

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    const onAbort = () => child.kill('SIGKILL')
    if (signal !== undefined) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.stdin.on('error', () => {})

    child.on('error', (error) => {
      clearTimeout(timer)
      settle({ ok: false, error: `sympy_calculate: cannot launch Python: ${String(error)}` })
    })

    child.on('close', (exitCode, exitSignal) => {
      clearTimeout(timer)
      if (signal !== undefined) signal.removeEventListener('abort', onAbort)
      if (timedOut) {
        settle({ ok: false, error: `sympy_calculate: timed out after ${Math.round(timeoutMs / 1000)} seconds` })
        return
      }
      if (exitSignal !== null && exitCode !== 0) {
        settle({ ok: false, error: `sympy_calculate: killed by ${exitSignal}` })
        return
      }
      if (exitCode !== 0) {
        settle({
          ok: false,
          error: `sympy_calculate: exit code ${exitCode}\n${clamp(stderr.trim() || stdout.trim())}`,
        })
        return
      }
      let text = stdout.trim()
      if (text === '') text = stderr.trim() === '' ? '(no output)' : stderr.trim()
      else if (stderr.trim() !== '') text += `\n[stderr]\n${stderr.trim()}`
      settle({ ok: true, text })
    })

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
      return clamp(outcome.text)
    },
  })
}
