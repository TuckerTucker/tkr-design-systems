#!/bin/bash
# Regenerate the artifact-pipeline test fixtures from the REAL wireframe
# skill (no hand-authored generation output). Run from anywhere:
#
#   bash studio/server/test/artifact-pipeline/fixtures/generate-fixtures.sh
#
# Produces (committed; tests read them without needing python):
#   swiss-dashboard/  — wireframe.svg + wireframe.spec.yaml via
#                       wireframe_skill.generator.wireframe(system="swiss",
#                       layout_id="dashboard") — the paths-branch fixture
#   assembled/        — wireframe.svg + wireframe.spec.yaml via
#                       wireframe_skill.decomposition/assembler (the same
#                       code path as the wf_assemble_from_blueprint MCP
#                       tool, output_dir branch) — carries the stable
#                       {region}__{component}_{idx} group ids; doubles as
#                       the text-branch fixture (tests read the file text)
#   violating/        — assembled/wireframe.svg with one off-scale
#                       font-size (17px) text element injected inside the
#                       main__banner-info_0 group: a known
#                       swiss-fixed-type-scale failure for the
#                       violation-to-node mapping tests
#
# The adversarial/ fixtures are hand-authored attack documents, NOT
# regenerated here — see README.md.
set -euo pipefail

FIXTURES_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$FIXTURES_DIR/../../../../.." && pwd)"
PYTHON="${PYTHON:-/usr/local/bin/python3}"

export PYTHONPATH="$REPO_ROOT/design-systems/wireframe-skill:$REPO_ROOT/design-systems/design-system-skill"

"$PYTHON" - "$FIXTURES_DIR" <<'PYEOF'
import sys
from pathlib import Path

fixtures = Path(sys.argv[1])

# ── 1. swiss-dashboard: real wf_generate output (paths branch) ──────
from wireframe_skill.generator import wireframe

result = wireframe(
    "analytics dashboard with stats and activity feed",
    platform="desktop",
    system="swiss",
    layout_id="dashboard",
    output_dir=fixtures / "swiss-dashboard",
)
assert result.ok, result.errors
print(f"swiss-dashboard: {result.svg_path}")

# ── 2. assembled: real blueprint assembly (group-id-carrying SVG) ───
from design_system_skill import load_system
from wireframe_skill.decomposition import validate_blueprint
from wireframe_skill.assembler import assemble_blueprint
from wireframe_skill.emit import emit_artifact

spec = load_system("swiss")
assert spec.ok, spec.errors
blueprint = {
    "schema_version": "1.0",
    "canvas": {"width": 1280, "height": 800, "platform": "desktop"},
    "regions": [
        {
            "id": "header",
            "x": 0, "y": 0, "w": 1280, "h": 96,
            "components": [
                {"component_id": "breadcrumb-default", "type": "library", "x": 40, "y": 32},
            ],
        },
        {
            "id": "main",
            "x": 0, "y": 96, "w": 1280, "h": 704,
            "components": [
                {"component_id": "banner-info", "type": "library", "x": 40, "y": 40},
                {"component_id": "badge-tag", "type": "library", "x": 40, "y": 140},
            ],
        },
    ],
}
errors = validate_blueprint(blueprint, spec.data)
assert not errors, errors
svg_text, warnings = assemble_blueprint(blueprint, spec.data)
components_used = []
for region in blueprint["regions"]:
    for comp in region["components"]:
        components_used.append({
            "id": comp["component_id"],
            "region": region["id"],
            "x": comp["x"],
            "y": comp["y"],
            "type": comp["type"],
        })
svg_path, spec_path = emit_artifact(
    fixtures / "assembled",
    svg_text,
    brief="assembled dashboard header with banner and badge",
    platform="desktop",
    spec=spec.data,
    selection=None,
    compliance=None,
    width=1280,
    height=800,
    components_used=components_used,
)
print(f"assembled: {svg_path} (warnings: {warnings})")

# ── 3. violating: assembled SVG + one off-scale font-size inside an
#       identified group (swiss type scale permits 9/11/13/14/22/32/40;
#       17 is a deterministic swiss-fixed-type-scale failure) ─────────
assembled_svg = (fixtures / "assembled" / "wireframe.svg").read_text()
marker = '<g id="main__banner-info_0" transform="translate(40, 136)">'
assert marker in assembled_svg, "expected assembled group id not found"
injected = (
    marker
    + '\n<text x="16" y="72" font-family="Inter, system-ui, sans-serif" '
    + 'font-size="17" fill="#000000">Off-scale annotation</text>'
)
violating = assembled_svg.replace(marker, injected, 1)
out = fixtures / "violating"
out.mkdir(exist_ok=True)
(out / "wireframe.svg").write_text(violating)
print(f"violating: {out / 'wireframe.svg'}")
PYEOF

echo "fixtures regenerated under $FIXTURES_DIR"
