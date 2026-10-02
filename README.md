# SymPy-Calculate

A DeepSeek Harness agent preset based on `minimal`. It adds one stateless
tool, `sympy_calculate`, which runs a complete Python script in a fresh
process using a local SymPy development checkout.

## Install

```sh
dsh plugin --profile web add github:11350613/SymPy-Calculate
```

`dsh` above is your launcher: a global `dsh`, `npx @deepseek-ai/dsh`, or `pnpm dsh`
in a source checkout.

Start or restart DeepSeek Harness, then select **SymPy Calculate** when creating
a session.

## Tested on

- Ubuntu 24.04.4 LTS
- DeepSeek Harness commit: [deepseek-ai/deepseek-harness@639ed01](https://github.com/deepseek-ai/deepseek-harness/commit/639ed015397290b3745d163aafe02ffee4aa3f84)
- SymPy commit: [sympy/sympy@6aabf6a](https://github.com/sympy/sympy/commit/6aabf6ac9eddd1c5141ff9a3a35dcb53a7b02228)

## Tool

`sympy_calculate`

```python
{
  "code": "from sympy import *\n\nx = symbols('x')\nprint(integrate(exp(-x**2), (x, -oo, oo)))\n"
}

sqrt(pi)
```
