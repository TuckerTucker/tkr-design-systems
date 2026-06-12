/**
 * Inspect model — builds the node-metadata map from the version's parsed
 * spec metadata (components_used), keyed by the stable
 * `{region}__{component}_{idx}` group ids the assembler emits and the
 * sanitizer preserves. Pure logic; InspectOverlay renders it.
 */
import type { ComponentUsed, ParsedSpecMetadata } from "@studio/contract";

export interface InspectTarget {
  /** Stable node ID preserved by artifact-pipeline. */
  nodeId: string;
  /** e.g. "card-default"; null when unmapped. */
  componentId: string | null;
  componentName: string | null;
  variant: string | null;
  region: string | null;
  componentType: "library" | "custom" | null;
  /** Blueprint placement, from the spec metadata. */
  position: { x: number; y: number } | null;
}

/** Split "banner-info" → name "banner", variant "info". */
function splitVariant(componentId: string): {
  name: string;
  variant: string | null;
} {
  const lastDash = componentId.lastIndexOf("-");
  if (lastDash <= 0 || lastDash === componentId.length - 1) {
    return { name: componentId, variant: null };
  }
  return {
    name: componentId.slice(0, lastDash),
    variant: componentId.slice(lastDash + 1),
  };
}

/**
 * Stable node id for one components_used entry: `{region}__{id}_{idx}`
 * where idx counts prior placements within the same region — matching the
 * assembler's group-id scheme (fixtures: header__breadcrumb-default_0,
 * main__banner-info_0, main__badge-tag_1).
 */
export function nodeIdFor(component: ComponentUsed, regionIndex: number): string {
  return `${component.region}__${component.id}_${regionIndex}`;
}

/** nodeId → target, built once per version from spec metadata. */
export function buildInspectTargets(
  metadata: ParsedSpecMetadata,
): ReadonlyMap<string, InspectTarget> {
  const targets = new Map<string, InspectTarget>();
  const regionCounters = new Map<string, number>();
  for (const component of metadata.design_system.components_used) {
    const regionIndex = regionCounters.get(component.region) ?? 0;
    regionCounters.set(component.region, regionIndex + 1);
    const nodeId = nodeIdFor(component, regionIndex);
    const { name, variant } = splitVariant(component.id);
    targets.set(nodeId, {
      nodeId,
      componentId: component.id,
      componentName: name,
      variant,
      region: component.region,
      componentType: component.type,
      position: { x: component.x, y: component.y },
    });
  }
  return targets;
}

/** Fallback target for a node with an id but no metadata mapping. */
export function unmappedTarget(nodeId: string): InspectTarget {
  return {
    nodeId,
    componentId: null,
    componentName: null,
    variant: null,
    region: null,
    componentType: null,
    position: null,
  };
}

/**
 * Resolve the inspect target for a hovered element: the innermost mapped
 * ancestor wins; an unmapped innermost id falls back to the nearest mapped
 * ancestor, or to the unmapped fallback when no ancestor maps.
 */
export function resolveTarget(
  element: Element | null,
  stageRoot: Element,
  targets: ReadonlyMap<string, InspectTarget>,
): InspectTarget | null {
  let firstIdSeen: string | null = null;
  let current: Element | null = element;
  while (current !== null && current !== stageRoot) {
    const id = current.getAttribute("id");
    if (id !== null && id !== "") {
      const mapped = targets.get(id);
      if (mapped !== undefined) {
        return mapped;
      }
      firstIdSeen = firstIdSeen ?? id;
    }
    current = current.parentElement;
  }
  return firstIdSeen !== null ? unmappedTarget(firstIdSeen) : null;
}

/** Ordered inspectable node ids for keyboard cycling. */
export function cycleOrder(
  targets: ReadonlyMap<string, InspectTarget>,
): string[] {
  return [...targets.keys()];
}

export function nextInCycle(
  targets: ReadonlyMap<string, InspectTarget>,
  currentNodeId: string | null,
  direction: 1 | -1,
): string | null {
  const order = cycleOrder(targets);
  if (order.length === 0) {
    return null;
  }
  const currentIndex =
    currentNodeId === null ? -1 : order.indexOf(currentNodeId);
  if (currentIndex === -1) {
    return (direction === 1 ? order[0] : order[order.length - 1]) ?? null;
  }
  const nextIndex =
    (currentIndex + direction + order.length) % order.length;
  return order[nextIndex] ?? null;
}
