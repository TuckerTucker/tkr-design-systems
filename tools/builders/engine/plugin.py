"""Per-system builder data: loading and shape validation.

Every system with an SVG library has a module ``engine.systems.<id>``
that exposes ``BUILDER``, a mapping from *kind* to that kind's data:

    BUILDER = {
        "library": {                      # -> <library_root>/components/
            "classes": TEXT_CLASSES,      # required: TextClass or (name, fill, font)
            "items": COMPONENTS,          # required: {id: (width, height, body)}
            "defs_extra": "...",          # optional: more <defs> children
            "wrap": wrap,                 # optional: envelope override
            "filters": {...},             # optional: extra placeholder filters
            "out_dir": "components",      # optional: defaults per kind
        },
        "patterns": {...},                # -> <library_root>/layouts/
    }

Bodies, ``defs_extra`` and class paths are templates: colours, fonts and
radii are ``{token.path}`` placeholders (see ``templates``). The engine
owns everything else (envelope, ``<defs>``, output paths, check mode),
so a module holds only what is specific to its system.

``validate_builder`` checks the shape and every placeholder against the
token document and returns messages that name the system, the kind, the
item and the missing key or token.
"""

from __future__ import annotations

import importlib
from collections.abc import Callable, Mapping
from types import ModuleType
from typing import Any

from .templates import FILTERS, TextClass, missing_paths

#: Kinds the engine knows, with the default output directory of each.
KIND_OUT_DIRS: dict[str, str] = {"library": "components", "patterns": "layouts"}

REQUIRED_KIND_KEYS = ("classes", "items")
OPTIONAL_KIND_KEYS = ("defs_extra", "wrap", "filters", "out_dir")

PLUGIN_PACKAGE = "engine.systems"


class BuilderDataError(ValueError):
    """Builder data for one or more systems is malformed.

    Attributes:
        messages: One human-readable problem per entry, each prefixed with
            the system id.
    """

    def __init__(self, messages: list[str]) -> None:
        super().__init__("\n".join(messages))
        self.messages = messages


def load_plugin(system_id: str, package: str = PLUGIN_PACKAGE) -> ModuleType | None:
    """Import ``<package>.<system_id>``.

    Args:
        system_id: Registry id, e.g. ``swiss``.
        package: Package that holds the per-system modules.

    Returns:
        The module, or ``None`` when the system has no builder module.
    """
    name = f"{package}.{system_id}"
    try:
        return importlib.import_module(name)
    except ModuleNotFoundError as exc:
        if exc.name in (name, package):
            return None
        raise


def builder_of(system_id: str, module: ModuleType) -> Mapping[str, Any]:
    """Return a plugin module's ``BUILDER`` mapping.

    Raises:
        BuilderDataError: If the module defines no ``BUILDER`` mapping.
    """
    data = getattr(module, "BUILDER", None)
    if not isinstance(data, Mapping):
        raise BuilderDataError(
            [f"{system_id}: module {module.__name__} defines no BUILDER mapping"])
    return data


def text_classes(raw: Any) -> list[TextClass]:
    """Coerce ``classes`` entries to ``TextClass`` (tuples are accepted)."""
    return [c if isinstance(c, TextClass) else TextClass(*c) for c in raw]


def kind_filters(kind_data: Mapping[str, Any]) -> dict[str, Callable[[Any, str], str]]:
    """Return the filters available to one kind's templates."""
    return {**FILTERS, **dict(kind_data.get("filters") or {})}


def _check_class(where: str, entry: Any) -> list[str]:
    """Validate one ``classes`` entry."""
    if isinstance(entry, TextClass):
        return []
    if (isinstance(entry, (tuple, list)) and len(entry) == 3
            and all(isinstance(x, str) and x for x in entry)):
        return []
    return [f"{where}: expected (name, fill_token, font_token), got {entry!r}"]


def _check_item(where: str, item: Any) -> list[str]:
    """Validate one ``items`` entry's shape."""
    if (isinstance(item, (tuple, list)) and len(item) == 3
            and isinstance(item[0], int) and isinstance(item[1], int)
            and isinstance(item[2], str)):
        if item[0] <= 0 or item[1] <= 0:
            return [f"{where}: width and height must be positive, got {item[0]}x{item[1]}"]
        return []
    return [f"{where}: expected (width: int, height: int, body: str), got {type(item).__name__}"]


def validate_builder(system_id: str, data: Any, tokens: Mapping[str, Any]) -> list[str]:
    """Check a ``BUILDER`` mapping's shape and its token references.

    Args:
        system_id: System id used to prefix every message.
        data: The ``BUILDER`` value.
        tokens: The system's token document.

    Returns:
        Problems, each naming the system, kind, item and missing key or
        token. Empty when the data can be rendered.
    """
    if not isinstance(data, Mapping):
        return [f"{system_id}: BUILDER must be a mapping of kind -> data, "
                f"got {type(data).__name__}"]
    if not data:
        return [f"{system_id}: BUILDER declares no kinds "
                f"(expected one of {sorted(KIND_OUT_DIRS)})"]
    errors: list[str] = []
    for kind, kd in data.items():
        where = f"{system_id}: {kind}"
        if kind not in KIND_OUT_DIRS:
            errors.append(f"{where}: unknown kind (expected one of {sorted(KIND_OUT_DIRS)})")
            continue
        if not isinstance(kd, Mapping):
            errors.append(f"{where}: expected a mapping, got {type(kd).__name__}")
            continue
        for key in REQUIRED_KIND_KEYS:
            if key not in kd:
                errors.append(f"{where}: missing key '{key}'")
        for key in kd:
            if key not in REQUIRED_KIND_KEYS + OPTIONAL_KIND_KEYS:
                errors.append(f"{where}: unknown key '{key}'")
        if "wrap" in kd and not callable(kd["wrap"]):
            errors.append(f"{where}.wrap: must be callable")
        if "defs_extra" in kd and not isinstance(kd["defs_extra"], str):
            errors.append(f"{where}.defs_extra: must be a string")
        if "out_dir" in kd and not (isinstance(kd["out_dir"], str) and kd["out_dir"]):
            errors.append(f"{where}.out_dir: must be a non-empty string")
        filters = kind_filters(kd) if isinstance(kd.get("filters", {}), Mapping) else FILTERS

        def tokens_ok(loc: str, template: str) -> None:
            for path in missing_paths(template, tokens, filters):
                errors.append(f"{loc}: unknown token '{path}'")

        classes = kd.get("classes")
        if classes is not None:
            if isinstance(classes, (str, bytes)) or not hasattr(classes, "__iter__"):
                errors.append(f"{where}.classes: expected a sequence")
            else:
                for i, entry in enumerate(classes):
                    problems = _check_class(f"{where}.classes[{i}]", entry)
                    errors.extend(problems)
                    if not problems:
                        tc = entry if isinstance(entry, TextClass) else TextClass(*entry)
                        tokens_ok(f"{where}.classes[{i}] .{tc.name}",
                                  f"{{{tc.fill}}} {{{tc.font}}}")
        if isinstance(kd.get("defs_extra"), str):
            tokens_ok(f"{where}.defs_extra", kd["defs_extra"])
        items = kd.get("items")
        if items is not None:
            if not isinstance(items, Mapping):
                errors.append(f"{where}.items: expected a mapping of id -> (width, height, body)")
            elif not items:
                errors.append(f"{where}.items: is empty")
            else:
                for item_id, item in items.items():
                    loc = f"{where}.items['{item_id}']"
                    problems = _check_item(loc, item)
                    errors.extend(problems)
                    if not problems:
                        tokens_ok(loc, item[2])
    return errors
