# tkr-design-systems MCP Server

MCP server wrapping the design-system-skill and wireframe-skill packages.
Exposes <!-- generated:mcp-tool-count -->15<!-- /generated:mcp-tool-count --> tools over stdio transport for use with Claude Code, Claude Desktop,
and any MCP-compatible client.

## Tools

<!-- generated:mcp-tools -->
### Design System (8 tools)

| Tool | Description |
|------|-------------|
| `ds_list_systems` | List all design systems registered in the tkr-kit registry. |
| `ds_load_system` | Load and validate a design system spec by id. |
| `ds_validate_spec` | Validate a spec.yaml against the schema without modifying the registry. |
| `ds_register_system` | Register a new design system in the registry. |
| `ds_unregister_system` | Remove a design system from the registry. |
| `ds_get_rulebook` | Get the flattened rulebook for a design system. |
| `ds_check_compliance` | Check an SVG artifact against a design system's mechanical rulebook. |
| `ds_check_contrast` | Run the WCAG contrast and accent/danger hue gates on a system's tokens. |

### Wireframe (7 tools)

| Tool | Description |
|------|-------------|
| `wf_generate` | Generate a wireframe SVG from a free-text brief. |
| `wf_build_substitution_request` | Build a content substitution request for a wireframe pattern. |
| `wf_apply_substitutions` | Apply content substitutions to a wireframe SVG. |
| `wf_select_layout` | Browse a system's library of layout patterns and components. |
| `wf_assemble_from_blueprint` | Validate and assemble a component layout blueprint into a composited SVG. |
| `wf_get_tokens` | Get design tokens formatted for freehand SVG authoring. |
| `wf_read_component` | Read component SVG source and metadata for reference. |
<!-- /generated:mcp-tools -->

Generated from the `@mcp.tool()` functions in `server.py` (name and first
docstring line) by `uv run python tools/docs/generate.py`.

## Running Standalone

Dependencies are declared in the root `pyproject.toml` and pinned in `uv.lock`.
Launch with [uv](https://docs.astral.sh/uv/) from the repo root; it creates the
virtualenv and installs the locked dependencies on first run:

```bash
uv run --project . python tools/mcp-server/server.py
```

## Claude Code Setup

The repo includes `.mcp.json` at the root. Claude Code reads this automatically
when the project is opened — no manual registration needed. It launches the
server via `uv run --project . python tools/mcp-server/server.py`, so `uv` must
be on `PATH`.

To register manually instead:

```bash
claude mcp add tkr-design-systems -- uv run --project /path/to/repo \
  python /path/to/repo/tools/mcp-server/server.py
```

## Claude Desktop Setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tkr-design-systems": {
      "command": "uv",
      "args": [
        "run", "--project", "/path/to/repo",
        "python", "/path/to/repo/tools/mcp-server/server.py"
      ]
    }
  }
}
```

If Claude Desktop can't find `uv`, use its absolute path (`which uv`) as
`command`. Restart Claude Desktop after adding.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DESIGN_SYSTEM_SKILL_REGISTRY` | Override path to `registry.yaml` (test isolation) |

## Testing

```bash
uv run pytest -q tools/mcp-server/test_mcp_server.py

# All three suites
uv run pytest -q tools/design-system-skill/test_design_system_skill.py \
  tools/wireframe-skill/test_wireframe_skill.py tools/mcp-server/test_mcp_server.py
```

## Dependencies

Declared in the root `pyproject.toml`, locked in `uv.lock`:

- Python 3.12+
- `mcp` (MCP Python SDK, `>=1.26,<2` — `mcp.server.fastmcp` was removed in 2.x)
- `structlog`
- `PyYAML`
- `cairosvg`
- `pytest` (dev group)
