# SymPy-Calculate

A DeepSeek Harness agent preset based on `minimal`. It adds one stateless
tool, `sympy_calculate`, which runs a complete Python script in a fresh
process against a local SymPy development checkout.

> **Security:** `sympy_calculate` executes arbitrary Python with the current
> user's permissions and inherited environment. It is not sandboxed. Enable
> it only in sessions whose model and permission policy you trust.

## Highlights

- One preset: the `minimal` plane plus `sympy_calculate`.
- Every call starts a fresh Python process, so no state survives between calls.
- Points at a local SymPy checkout, so edits to that checkout apply immediately.
- Each call is bounded by a 120-second timeout and a 2,000,000-character output cap.

## Requirements

| Requirement | Version / notes |
| --- | --- |
| DeepSeek Harness | `0.2.0-rc.2` |
| Node.js | `^22.19.0` or `>=24.0.0` |
| pnpm | `11.7.0`; install with `npm install -g pnpm@11.7.0` if missing |
| git | Needed for the SymPy checkout; optional for the HTTPS install |
| Python | 3.x with `venv` and `pip` available |
| SymPy | Local checkout; default root `~/sympy-dev/sympy` |
| Platform | Tested on Ubuntu 24.04.4 LTS only; other platforms are untested |

Among shipped profiles, install into `web` only. The preset needs the
`agent-preset-registry` service supplied by the web bundle; in `headless`,
`sdk`, `sdk-minimal`, or `acp` it will not be selectable. A custom profile
can use it if that profile supplies `agent-preset-registry`.

## Set up SymPy

The tool uses this checkout root and interpreter candidates:

```text
~/sympy-dev/sympy
~/sympy-dev/sympy/venv/bin/python
~/sympy-dev/sympy/venv/bin/python3
```

On Ubuntu, install the venv tooling first if it is missing:

```sh
sudo apt install -y python3-venv python3-pip
```

Then create the checkout:

```sh
mkdir -p ~/sympy-dev
git clone https://github.com/sympy/sympy.git ~/sympy-dev/sympy
# Optional: use the exact tested SymPy revision.
git -C ~/sympy-dev/sympy checkout 6aabf6ac9eddd1c5141ff9a3a35dcb53a7b02228
python3 -m venv ~/sympy-dev/sympy/venv
~/sympy-dev/sympy/venv/bin/python -m pip install -e ~/sympy-dev/sympy
echo 'venv/' >> ~/sympy-dev/sympy/.git/info/exclude
```

The editable install also installs SymPy's external `mpmath` dependency.
Confirm the checkout before installing the plugin:

```sh
~/sympy-dev/sympy/venv/bin/python -c "import sympy; print(sympy.__version__)"
```

To use another checkout or interpreter, set both variables in the
environment that starts DeepSeek Harness:

| Variable | Default | Meaning |
| --- | --- | --- |
| `SYMPY_ROOT` | `~/sympy-dev/sympy` | Checkout root; also the `PYTHONPATH` |
| `SYMPY_PYTHON` | `<root>/venv/bin/python`, then `python3` | Python interpreter |

## Install

Install into the `web` profile. The commands pin `v1.0.1`, the tested
plugin revision. If `dsh` is already on your `PATH`, replace the
`npx --yes @deepseek-ai/dsh@0.2.0-rc.2` prefix with `dsh`.

HTTPS tarball, recommended because it needs no GitHub SSH key:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 plugin --profile web add \
  https://codeload.github.com/11350613/SymPy-Calculate/tar.gz/v1.0.1
```

<details>
<summary>Alternative installs: GitHub shorthand or a DeepSeek Harness source checkout</summary>

Git shorthand, when GitHub SSH access is already configured:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 plugin --profile web add \
  github:11350613/SymPy-Calculate#v1.0.1
```

From a source checkout, use `pnpm dsh` and prefer the tarball form:

```sh
pnpm dsh plugin --profile web add \
  https://codeload.github.com/11350613/SymPy-Calculate/tar.gz/v1.0.1
```

</details>

Start or restart the web profile, then select **SymPy Calculate** when
creating a session.

## Verify

Check that the bundle and preset are in the composed config:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 --profile web --dump-config \
  | grep "SymPy Calculate"
```

Boot the profile once without a browser to surface plugin activation errors:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 --profile web --help
```

Then start the UI and confirm that **SymPy Calculate** appears in the preset
picker without an error marker:

```sh
npx --yes @deepseek-ai/dsh@0.2.0-rc.2 --profile web --no-open
```

## Usage

In a session using the **SymPy Calculate** preset, ask:

```text
Use sympy_calculate to integrate exp(-x**2) from -oo to oo.
```

`sympy_calculate` expects one complete script. Include imports and print the
results:

```json
{
  "code": "from sympy import *\n\nx = symbols('x')\nprint(integrate(exp(-x**2), (x, -oo, oo)))\n"
}
```

Output:

```text
sqrt(pi)
```

Because every call starts a fresh interpreter and pays the SymPy import
cost, batch related computations into one script instead of making many
small calls. stdout and stderr are combined; a non-zero exit is returned as
a tool error.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `sympy_calculate: no Python interpreter under ...` | Run the SymPy setup above, or export `SYMPY_ROOT` / `SYMPY_PYTHON` before starting `dsh`. |
| `python3 -m venv` fails with `ensurepip is not available` | Install `python3-venv`; on Ubuntu 24.04 also install `python3.12-venv`. |
| `ModuleNotFoundError: No module named 'mpmath'` | Install the checkout with `pip install -e`; a bare `git clone` has no dependencies. |
| The preset is missing after installing | Restart the web profile, and check that `dsh-sympy-calculate` is listed in the profile's `package.json` dependencies and `dsh.profile.bundles`. |
| The preset shows a broken/error marker | Run `dsh --profile web --help` and read the loader error. The usual cause is installing into a profile without `agent-preset-registry`. |
| Remove the plugin | `dsh plugin --profile web remove dsh-sympy-calculate` |

## Tested on

- SymPy-Calculate release: `v1.0.1`
- Ubuntu 24.04.4 LTS
- DeepSeek Harness commit: [deepseek-ai/deepseek-harness@639ed01](https://github.com/deepseek-ai/deepseek-harness/commit/639ed015397290b3745d163aafe02ffee4aa3f84)
- SymPy commit: [sympy/sympy@6aabf6a](https://github.com/sympy/sympy/commit/6aabf6ac9eddd1c5141ff9a3a35dcb53a7b02228)

## Issues

Bug reports and feature requests: <https://github.com/11350613/SymPy-Calculate/issues>

## License

MIT. See [LICENSE](LICENSE).
