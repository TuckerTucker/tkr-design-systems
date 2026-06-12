# tkr-design-systems MCP Server

MCP server wrapping the design-system-skill and wireframe-skill packages.
Exposes 11 tools over stdio transport for use with Claude Code, Claude Desktop,
and any MCP-compatible client.

## Tools

### Design System (7 tools)

| Tool | Description |
|------|-------------|
| `ds_list_systems` | List all registered design systems |
| `ds_load_system` | Load and validate a system spec by id |
| `ds_validate_spec` | Validate a spec.yaml without registering |
| `ds_register_system` | Register a new system in the registry |
| `ds_unregister_system` | Remove a system from the registry |
| `ds_get_rulebook` | Get flattened rulebook for a system |
| `ds_check_compliance` | Check SVG against mechanical rulebook |

### Wireframe (4 tools)

| Tool | Description |
|------|-------------|
| `wf_generate` | Generate a wireframe SVG from a brief |
| `wf_build_substitution_request` | Build a content substitution request (two-pass Pass 1) |
| `wf_apply_substitutions` | Apply substitutions to a wireframe SVG (two-pass Pass 2) |
| `wf_assemble_from_blueprint` | Validate and assemble a component blueprint into SVG |

## Running Standalone

```bash
/usr/local/bin/python3 tools/mcp-server/server.py
```

## Claude Code Setup

The repo includes `.mcp.json` at the root. Claude Code reads this automatically
when the project is opened — no manual registration needed.

To register manually instead:

```bash
claude mcp add tkr-design-systems /usr/local/bin/python3 \
  -- /path/to/tools/mcp-server/server.py
```

## Claude Desktop Setup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tkr-design-systems": {
      "command": "/usr/local/bin/python3",
      "args": ["/path/to/tools/mcp-server/server.py"]
    }
  }
}
```

Restart Claude Desktop after adding.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DESIGN_SYSTEM_SKILL_REGISTRY` | Override path to `registry.yaml` (test isolation) |

## Testing

```bash
/usr/local/bin/python3 tools/mcp-server/test_mcp_server.py
```

## Dependencies

- Python 3.12+
- `mcp` (MCP Python SDK, v1.26.0+)
- `structlog`
- `PyYAML`
