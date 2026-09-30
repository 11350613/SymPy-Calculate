# SymPy-Calculate

A DeepSeek Harness agent preset based on `minimal`. It adds one stateless
tool, `sympy_calculate`, which runs a complete Python script in a fresh
process using a local SymPy development checkout.

## Tested on

- Ubuntu 24.04.4 LTS
- DeepSeek Harness commit: [deepseek-ai/deepseek-harness@c291e79](https://github.com/deepseek-ai/deepseek-harness/commit/c291e7961a515f6d7af9304e7fd1d257929aef26)
- SymPy commit: [sympy/sympy@6aabf6a](https://github.com/sympy/sympy/commit/6aabf6ac9eddd1c5141ff9a3a35dcb53a7b02228)

## Tool

`sympy_calculate`

```python
{
  "code": "from sympy import *\n\nx = symbols('x')\nI = integrate(exp(-x**2), (x, -oo, oo))\nprint(I)\n"
}

sqrt(pi)
```
