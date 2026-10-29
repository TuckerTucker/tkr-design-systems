"""Per-system builder data, one package per registry id.

Each package exposes ``BUILDER`` (see ``engine.plugin`` for the shape):
its SVG body templates (``library.py``, ``patterns.py``) and the text
classes of the shared ``<defs>`` block. Colours, fonts, radii and border
widths are ``{token.path}`` placeholders resolved from
``systems/<id>/tokens.json`` (radii and border widths wherever they play a
token role; pill and glyph geometry stays literal). A test keeps colour and
font literals out of the templates.

Adding a system: create ``engine/systems/<id>/`` with a ``BUILDER``,
register the system in ``systems/registry.yaml`` and run
``uv run python tools/builders/build.py --system <id>``.
"""
