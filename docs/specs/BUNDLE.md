# The skill bundle

`bundle/design-system-skill/` and `bundle/wireframe-skill/` hold the two skills in the layout tkr-kit vendors at `.claude/skills/<skill>/` (tkr-kit ADR-067, decision 7). tkr-kit syncs them from a tag of this repository by copying files. It runs no Python and no build step to do that, so the bundle is committed, and CI fails when it is stale.

Nothing under `bundle/` is edited by hand. Change the sources, then regenerate:

```bash
uv run python tools/bundle/build_bundle.py           # rewrite bundle/
uv run python tools/bundle/build_bundle.py --check   # CI: exit 1 on a stale, missing or extra file
```

This file is not bundled. Anything placed in `bundle/<skill>/` lands in tkr-kit's skill tree.

## What goes where

| Source | Bundle |
|---|---|
| `LICENSE`, `NOTICE` | both skills, at the root |
| `conftest.py` | both skills, `scripts/conftest.py` (keeps the user registry overlay out of the bundled tests) |
| `systems/registry.yaml` | `design-system-skill/libraries/registry.yaml`, with entry paths renamed `<id>/` → `<id>-library/` |
| `systems/<id>/` | `design-system-skill/libraries/<id>-library/` |
| `docs/specs/*.md` | `design-system-skill/references/` |
| `tools/design-system-skill/SKILL.md`, `schemas/` | `design-system-skill/` root |
| `tools/design-system-skill/` (CLI, MCP bridge, package, tests) | `design-system-skill/scripts/` |
| `tools/builders/test_ux_clauses.py` | `design-system-skill/scripts/test_ux_clauses.py` |
| `tools/builders/` (rulebook, engine, renderer, fixtures, calibration) | `design-system-skill/tooling/` |
| `tools/wireframe-skill/SKILL.md` | `wireframe-skill/SKILL.md` |
| `tools/wireframe-skill/` (CLI, MCP bridge, package, tests) | `wireframe-skill/scripts/` |

The rules, and the files left out with the reason for each, are `PREFIX_RULES`, `SYSTEM_RULE`, `EXCLUDED` and `EXCLUDED_PATTERNS` in `tools/bundle/build_bundle.py`. The PNG previews under `systems/` are among them: nothing in the skills or in tkr-kit reads them. Every file under a scanned root (`SCANNED_ROOTS`) must be mapped or excluded, so the build fails when a new file is neither. Everything outside the scanned roots is repository-only: `apps/`, `tools/mcp-server/`, `tools/e2e/`, `tools/docs/` and `docs/adr/`.

## Code that runs in both layouts

The code is copied byte for byte. It finds its files in either layout by itself:

- `design_system_skill/paths.py` finds the registry (`systems/registry.yaml` or `libraries/registry.yaml`), the tooling directory (`tools/builders` or `tooling/`), the reference docs (`docs/specs` or `references/`) and a built-in system's library directory.
- `rulebook_check.py`'s `system_dir()` finds the token files the rulebook reads. It uses only the standard library, because tkr-kit imports it under `python3 -I`.
- `wireframe_skill/_design_system_path.py` finds the design-system package.
- `tools/builders/engine` and `build.py` find the package and the registry the same way.

Tests resolve system directories through the registry (`builtin_library_dir`), never by joining `systems/<id>`. That is why the bundled tests pass from `.claude/skills/`.

## Doc paths

Each bundled `SKILL.md` and `references/*.md` is rewritten so that every path it names resolves where it lands. Three places in a doc are read:

- an inline code span that is a single path
- a path argument on a `python3` / `uv run` command line, in an inline span or in a fence that contains one
- a markdown link target

Each path is rewritten as follows:

- A bundled path is written relative to the doc's skill root. A path in the other skill gets `../<skill>/`. On a command line it gets `${CLAUDE_SKILL_DIR}/`, and in a link it is file-relative.
- A command's CLI head (`python3 tools/design-system-skill`, `uv run python …`) becomes `python3 ${CLAUDE_SKILL_DIR}/scripts/__main__.py`.
- A repository path that is not bundled becomes a URL on `main`. A command that runs an unbundled script is an error, because the bundle could not run it. Name such a script as a path instead.
- A path that is neither bundled nor in the repository is an error. Fix the doc.

After the rewrite the builder checks every bundled doc again, and the build fails if a path does not resolve inside the bundle.

Some paths are not checked, by design:

- URLs
- absolute and `~/` paths (the caller's filesystem)
- `.claude/…` (the consuming project's own tree)
- bare file names
- fenced blocks without a command: directory diagrams, and YAML and JSON examples, which illustrate rather than point
- the deliberate example paths in `EXAMPLE_PATHS`, each listed with its reason

## Ignored files

Running the bundled tests in place creates `__pycache__/`, `.pytest_cache/` and `.DS_Store`. These are gitignored, and `--check` skips them, so neither tkr-kit's drift check nor this one reports them (ADR-067, decision 8).

## Proof

`tools/bundle/test_build_bundle.py` covers the following:

- `--check` catches a stale, a missing and an extra file.
- An unmapped source file and an unresolvable doc path both stop the build.
- The bundle is installed into a temporary `.claude/skills/`. From there the test runs both CLIs (list, load, validate, check, generate, solve-layout), both MCP bridges, `rulebook_check.py` under `python3 -I`, and `tooling/build.py --check`.
- Every bundled test runs from the bundle.
