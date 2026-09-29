# SymPy-Calculate

A DeepSeek Harness agent preset based on `minimal`. It adds one stateless
tool, `sympy_calculate`, which runs a complete Python script in a fresh
process using a local SymPy development checkout.

## Files

- `preset.yml` - preset metadata
- `agent.cordis.yml` - minimal composition plus the `sympy_calculate` tool
- `tool/sympy-calculate.mjs` - the tool plugin

## Requirements

- DeepSeek Harness with the `dsh-agent-presets` plugin
- A local SymPy development checkout

Default checkout root:

```text
~/sympy-dev/sympy
```

Override with:

```text
SYMPY_ROOT
SYMPY_PYTHON
```

## Tested with

- Ubuntu 24.04.4 LTS
- DeepSeek Harness commit: c291e7961a515f6d7af9304e7fd1d257929aef26
- SymPy commit 6aabf6ac9eddd1c5141ff9a3a35dcb53a7b02228

## Install

```bash
cp -r . ~/.dsh/.agent-presets/sympy-calculate
```

Then start a new Harness session and select the `SymPy Calculate` preset.

## Tool

```text
sympy_calculate(code="...")
```

Each call starts a fresh Python process. State does not persist between calls.
