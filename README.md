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
