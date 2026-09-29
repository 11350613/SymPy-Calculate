# SymPy-Calculate

A DeepSeek Harness agent preset based on `minimal`. It adds one stateless
tool, `sympy_calculate`, which runs a complete Python script in a fresh
process using a local SymPy development checkout.

## Tested with

- Ubuntu 24.04.4 LTS
- DeepSeek Harness commit: c291e7961a515f6d7af9304e7fd1d257929aef26
- SymPy commit: 6aabf6ac9eddd1c5141ff9a3a35dcb53a7b02228

## Tool

```text
sympy_calculate(code="...")
```

Each call starts a fresh Python process. State does not persist between calls.
