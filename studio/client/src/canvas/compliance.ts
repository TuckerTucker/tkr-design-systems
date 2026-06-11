/**
 * Compliance bar model — pure mapping from the API's ComplianceResponse
 * projection (per-rule status with violation nodeIds already resolved by
 * artifact-pipeline) into the bar's render model, plus the bar's
 * per-version state vocabulary (pending/unavailable/error render in place,
 * never block the stage).
 */
import type {
  ApiError,
  ComplianceResponse,
  ComplianceStatus,
} from "@studio/contract";

export interface ComplianceRuleModel {
  ruleId: string;
  status: ComplianceStatus;
  /** Human-readable evidence; rules without one get a generic line. */
  message: string;
  /** Stable SVG node ids; [] → highlight disabled-with-reason. */
  nodeIds: string[];
}

export interface ComplianceBarModel {
  overall: ComplianceStatus;
  passed: number;
  failed: number;
  advisory: number;
  rules: ComplianceRuleModel[];
}

export type ComplianceBarState =
  | { kind: "pending" }
  | { kind: "unavailable"; reason: string }
  | { kind: "error"; error: ApiError }
  | { kind: "ready"; model: ComplianceBarModel };

export function toComplianceBarModel(
  response: ComplianceResponse,
): ComplianceBarModel {
  return {
    overall: response.status,
    passed: response.passed,
    failed: response.failed,
    advisory: response.advisory,
    rules: response.rules.map((rule) => ({
      ruleId: rule.ruleId,
      status: rule.status,
      message:
        rule.message ??
        (rule.status === "pass"
          ? "This rule passed."
          : "The rule reported a violation without further detail."),
      nodeIds: rule.nodeIds,
    })),
  };
}

/** Non-color status indicator (WCAG: color never the only channel). */
export function statusGlyph(status: ComplianceStatus): string {
  switch (status) {
    case "pass":
      return "✓";
    case "warn":
      return "!";
    case "fail":
      return "✕";
  }
}

export function statusLabel(status: ComplianceStatus): string {
  switch (status) {
    case "pass":
      return "Pass";
    case "warn":
      return "Warning";
    case "fail":
      return "Fail";
  }
}
