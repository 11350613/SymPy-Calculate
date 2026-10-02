# SymPy-Calculate

A DeepSeek Harness agent preset based on `minimal`. It adds one stateless
tool, `sympy_calculate`, which runs a complete Python script in a fresh
process against a local SymPy development checkout.

## Prerequisites

- **Node.js** 22.19+ (or 24+) and **pnpm**. `dsh plugin` forwards to pnpm,
  so install the tested pnpm version once:

  ```sh
  npm install --global pnpm@11.7.0
  pnpm --version
  ```

- **git** for cloning SymPy and for the Git install option.
- **Python 3** for the SymPy virtual environment.
- **DeepSeek Harness**. The commands below use
  `npx --yes @deepseek-ai/dsh@0.2.0-rc.2`, the release built from the tested
  Harness commit. If `dsh` is already on your `PATH`, replace that prefix
  with `dsh`.

- **A local SymPy development checkout.** The tool searches these defaults:

  ```text
  ~/sympy-dev/sympy
  ~/sympy-dev/sympy/venv/bin/python
  ~/sympy-dev/sympy/venv/bin/python3
  ```

  Set it up once on Ubuntu or another POSIX system:

  ```sh
  git clone https://github.com/sympy/sympy.git ~/sympy-dev/sympy
  # Optional: use the exact tested SymPy revision.
  git -C ~/sympy-dev/sympy checkout 6aabf6ac9eddd1c5141ff9a3a35dcb53a7b02228
  python3 -m venv ~/sympy-dev/sympy/venv
  ~/sympy-dev/sympy/venv/bin/python -m pip install -e ~/sympy-dev/sympy
  ~/sympy-dev/sympy/venv/bin/python -c "import sympy; print(sympy.__version__)"
  echo 'venv/' >> ~/sympy-dev/sympy/.git/info/exclude
  ```

  The editable install also brings in SymPy's external `mpmath` dependency.
  To use another checkout or interpreter, export these in the environment
  that starts DeepSeek Harness:

  ```sh
  export SYMPY_ROOT=/path/to/sympy
  export SYMPY_PYTHON=/path/to/venv/bin/python
  ```

  On Windows, set `SYMPY_PYTHON` explicitly: the built-in defaults look for
  the POSIX `venv/bin` layout.

## Install

Install into the `web` profile. The commands below pin the tested plugin
commit.

HTTPS tarball, no GitHub SSH key required:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 plugin --profile web add \
  https://codeload.github.com/11350613/SymPy-Calculate/tar.gz/9c096d7defda65d0df967c95f970ba22d8e9d07a
```

Git shorthand, requires GitHub SSH access:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 plugin --profile web add \
  github:11350613/SymPy-Calculate#9c096d7defda65d0df967c95f970ba22d8e9d07a
```

From a DeepSeek Harness source checkout (not this repository):

```sh
pnpm install
pnpm dsh plugin --profile web add \
  github:11350613/SymPy-Calculate#9c096d7defda65d0df967c95f970ba22d8e9d07a
```

Start or restart DeepSeek Harness, then select **SymPy Calculate** when
creating a session.

## Verify

The installed preset should appear in the composed config:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 --profile web --dump-config \
  | grep "SymPy Calculate"
```

Start the web UI with:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 --profile web --no-open
```

Open the printed URL, create a new session, and confirm that
**SymPy Calculate** is listed in the preset picker.

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
