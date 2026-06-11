/**
 * Decision-chip model — chip construction from real vocabularies (registry
 * systems, routing_request patterns, the platform set), boundary validation
 * of chip updates, and the chip-change → re-run mapping.
 */
import type {
  ChipKind,
  ChipSet,
  ChipUpdate,
  DecisionChip,
  DecisionDefaults,
} from "@studio/contract";

export const PLATFORM_OPTIONS: readonly string[] = ["mobile", "desktop"];

/** Layout chip value shown when the artifact was composed from a blueprint. */
export const COMPOSED_LAYOUT_VALUE = "composed";

export interface BuildChipSetArgs {
  artifactId: string;
  messageId: string;
  defaults: DecisionDefaults;
  /** Registry system ids (injected catalog); the current value is ensured. */
  systemOptions: readonly string[];
  /** Pattern ids from routing_request / wf_select_layout; value ensured. */
  layoutOptions: readonly string[];
  /** Which step a chip change re-runs on this turn's artifact. */
  rerunStep: "generate" | "compose";
}

function withValue(options: readonly string[], value: string): string[] {
  return options.includes(value) ? [...options] : [value, ...options];
}

export function buildChipSet(args: BuildChipSetArgs): ChipSet {
  const { defaults, rerunStep } = args;
  const layoutValue = defaults.layoutId ?? COMPOSED_LAYOUT_VALUE;
  const chips: DecisionChip[] = [
    {
      kind: "system",
      value: defaults.system,
      options: withValue(args.systemOptions, defaults.system),
      rerunStep,
    },
    {
      kind: "layout",
      value: layoutValue,
      options: withValue(args.layoutOptions, layoutValue),
      rerunStep,
    },
    {
      kind: "platform",
      value: defaults.platform,
      options: [...PLATFORM_OPTIONS],
      rerunStep,
    },
  ];
  return { artifactId: args.artifactId, messageId: args.messageId, chips };
}

export type ChipValidation =
  | { ok: true; chip: DecisionChip }
  | { ok: false; message: string; fix: string };

/**
 * Boundary validation: the update's value must be one of the chip's
 * options. Rejected before any re-run starts — no tool call occurs.
 */
export function validateChipUpdate(
  chipSet: ChipSet | null,
  update: ChipUpdate,
): ChipValidation {
  if (chipSet === null) {
    return {
      ok: false,
      message: `No decision chips are recorded for artifact "${update.artifactId}"`,
      fix: "Generate the artifact first; chips are emitted with the generation turn.",
    };
  }
  const chip = chipSet.chips.find((entry) => entry.kind === update.kind);
  if (chip === undefined) {
    return {
      ok: false,
      message: `Chip kind "${update.kind}" does not exist on this turn`,
      fix: "Use one of the chip kinds the turn emitted: system, layout, platform.",
    };
  }
  if (!chip.options.includes(update.value)) {
    return {
      ok: false,
      message:
        `"${update.value}" is not an option for the ${update.kind} chip ` +
        `(options: ${chip.options.join(", ")})`,
      fix: "Pick one of the chip's listed options.",
    };
  }
  return { ok: true, chip };
}

/** Apply a validated chip value onto the artifact's decision defaults. */
export function applyChipValue(
  defaults: DecisionDefaults,
  kind: ChipKind,
  value: string,
): DecisionDefaults {
  switch (kind) {
    case "system":
      return { ...defaults, system: value };
    case "layout":
      return {
        ...defaults,
        layoutId: value === COMPOSED_LAYOUT_VALUE ? null : value,
      };
    case "platform":
      return {
        ...defaults,
        platform: value === "mobile" ? "mobile" : "desktop",
      };
  }
}
