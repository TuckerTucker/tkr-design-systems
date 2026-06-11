/**
 * Boundary validation — every HTTP body, route param, and WS message is
 * validated against the contract before any domain code runs. Rejections
 * carry a structured ApiError naming the offending field and the fix;
 * client input never reaches filesystem path resolution (slug-shape
 * validation is the path-traversal hardening).
 */
import {
  CLIENT_MESSAGE_TYPES,
  type ApiError,
  type ChatSendPayload,
  type ChipUpdatePayload,
  type ClientMessage,
  type LayoutPreference,
  type WorkspaceCreateRequest,
  type WorkspacePatchRequest,
  type WorkspaceSettings,
} from "@studio/contract";

import { apiError } from "./errors.js";

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; error: ApiError };

export function valid<T>(value: T): Validation<T> {
  return { ok: true, value };
}

export function invalid<T = never>(error: ApiError): Validation<T> {
  return { ok: false, error };
}

function invalidField<T = never>(
  field: string,
  message: string,
  fix: string,
): Validation<T> {
  return invalid(apiError("invalid_field", message, fix, field));
}

// ── Identifier shapes (path-traversal hardening) ──

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 128;

export function isKebabSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAX_SLUG_LENGTH &&
    SLUG_PATTERN.test(value)
  );
}

export function validateSlugParam(
  value: unknown,
  field: string,
): Validation<string> {
  if (!isKebabSlug(value)) {
    return invalidField(
      field,
      `"${String(value)}" is not a valid ${field}`,
      `${field} must be a kebab-case slug (lowercase letters, digits, single hyphens).`,
    );
  }
  return valid(value);
}

/** Canonical positive integer, no leading zeros, bounded (1–999999). */
const VERSION_PATTERN = /^[1-9][0-9]{0,5}$/;

export function validateVersionParam(value: unknown): Validation<number> {
  if (typeof value !== "string" || !VERSION_PATTERN.test(value)) {
    return invalidField(
      "version",
      `"${String(value)}" is not a valid version number`,
      "version must be a positive integer without leading zeros, e.g. 7.",
    );
  }
  return valid(Number.parseInt(value, 10));
}

// ── Generic shape helpers ──

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownKeys(
  body: Record<string, unknown>,
  allowed: readonly string[],
): string[] {
  return Object.keys(body).filter((key) => !allowed.includes(key));
}

const MAX_NAME_LENGTH = 200;

function validateName(value: unknown, field: string): Validation<string> {
  if (typeof value !== "string") {
    return invalidField(
      field,
      `${field} must be a string (got ${typeof value})`,
      `Send ${field} as a non-empty string.`,
    );
  }
  if (value.trim() === "") {
    return invalidField(
      field,
      `${field} must not be empty`,
      `Send ${field} as a non-empty string.`,
    );
  }
  if (value.length > MAX_NAME_LENGTH) {
    return invalidField(
      field,
      `${field} exceeds ${MAX_NAME_LENGTH} characters`,
      `Shorten ${field} to at most ${MAX_NAME_LENGTH} characters.`,
    );
  }
  return valid(value);
}

function validateSettings(value: unknown): Validation<WorkspaceSettings> {
  if (!isRecord(value)) {
    return invalidField(
      "settings",
      "settings must be an object",
      'Send settings as { defaultSystem?: string, defaultPlatform?: "mobile" | "desktop" }.',
    );
  }
  const extra = unknownKeys(value, ["defaultSystem", "defaultPlatform"]);
  if (extra.length > 0) {
    return invalidField(
      `settings.${extra[0]}`,
      `settings carries an unknown field "${extra[0]}"`,
      "Only defaultSystem and defaultPlatform are accepted workspace settings.",
    );
  }
  const settings: WorkspaceSettings = {};
  if (value["defaultSystem"] !== undefined) {
    if (typeof value["defaultSystem"] !== "string") {
      return invalidField(
        "settings.defaultSystem",
        "defaultSystem must be a string",
        'Send defaultSystem as a system id, e.g. "swiss".',
      );
    }
    settings.defaultSystem = value["defaultSystem"];
  }
  if (value["defaultPlatform"] !== undefined) {
    if (
      value["defaultPlatform"] !== "mobile" &&
      value["defaultPlatform"] !== "desktop"
    ) {
      return invalidField(
        "settings.defaultPlatform",
        `defaultPlatform must be "mobile" or "desktop"`,
        'Send defaultPlatform as "mobile" or "desktop".',
      );
    }
    settings.defaultPlatform = value["defaultPlatform"];
  }
  return valid(settings);
}

// ── HTTP bodies ──

export function validateWorkspaceCreate(
  body: unknown,
): Validation<WorkspaceCreateRequest> {
  if (body === undefined || body === null) {
    return valid({});
  }
  if (!isRecord(body)) {
    return invalidField(
      "body",
      "the request body must be a JSON object",
      "Send {} or { name: string }.",
    );
  }
  const extra = unknownKeys(body, ["name"]);
  if (extra.length > 0) {
    return invalidField(
      extra[0] as string,
      `unknown field "${extra[0]}"`,
      "POST /api/workspaces accepts only { name?: string }.",
    );
  }
  if (body["name"] === undefined) {
    return valid({});
  }
  const name = validateName(body["name"], "name");
  return name.ok ? valid({ name: name.value }) : invalid(name.error);
}

export function validateWorkspacePatch(
  body: unknown,
): Validation<WorkspacePatchRequest> {
  if (!isRecord(body)) {
    return invalidField(
      "body",
      "the request body must be a JSON object",
      "Send { name?: string, settings?: object } with at least one field.",
    );
  }
  const extra = unknownKeys(body, ["name", "settings"]);
  if (extra.length > 0) {
    return invalidField(
      extra[0] as string,
      `unknown field "${extra[0]}"`,
      "PATCH /api/workspaces/:wsId accepts only name and settings.",
    );
  }
  if (body["name"] === undefined && body["settings"] === undefined) {
    return invalidField(
      "body",
      "the patch carries no fields",
      "Send at least one of name or settings.",
    );
  }
  const patch: WorkspacePatchRequest = {};
  if (body["name"] !== undefined) {
    const name = validateName(body["name"], "name");
    if (!name.ok) {
      return invalid(name.error);
    }
    patch.name = name.value;
  }
  if (body["settings"] !== undefined) {
    const settings = validateSettings(body["settings"]);
    if (!settings.ok) {
      return invalid(settings.error);
    }
    patch.settings = settings.value;
  }
  return valid(patch);
}

/**
 * LayoutPreference (preferences.ts, owned by docking-shell). Unknown
 * panelIds and zones are accepted (forward compatibility for future
 * panels); unknown top-level fields are rejected so the store never
 * persists unvetted shapes.
 */
export function validatePreferences(
  body: unknown,
): Validation<LayoutPreference> {
  if (!isRecord(body)) {
    return invalidField(
      "body",
      "the request body must be a LayoutPreference object",
      "Send { schemaVersion: 1, placements, activeTab, railWidths, lastWorkspaceId }.",
    );
  }
  const allowed = [
    "schemaVersion",
    "placements",
    "activeTab",
    "railWidths",
    "lastWorkspaceId",
  ];
  const extra = unknownKeys(body, allowed);
  if (extra.length > 0) {
    return invalidField(
      extra[0] as string,
      `unknown field "${extra[0]}"`,
      `PUT /api/preferences accepts only: ${allowed.join(", ")}.`,
    );
  }
  if (body["schemaVersion"] !== 1) {
    return invalidField(
      "schemaVersion",
      "schemaVersion must be the literal 1",
      "Send schemaVersion: 1.",
    );
  }
  if (!Array.isArray(body["placements"])) {
    return invalidField(
      "placements",
      "placements must be an array",
      "Send placements as an array of { panelId, zone }.",
    );
  }
  for (const [index, entry] of body["placements"].entries()) {
    if (
      !isRecord(entry) ||
      typeof entry["panelId"] !== "string" ||
      typeof entry["zone"] !== "string"
    ) {
      return invalidField(
        `placements[${index}]`,
        "each placement must carry panelId and zone strings",
        "Send placements entries as { panelId: string, zone: string }.",
      );
    }
  }
  if (typeof body["activeTab"] !== "string") {
    return invalidField(
      "activeTab",
      "activeTab must be a string",
      "Send activeTab as the active panel tab id.",
    );
  }
  const rails = body["railWidths"];
  if (
    !isRecord(rails) ||
    typeof rails["left"] !== "number" ||
    typeof rails["right"] !== "number" ||
    !Number.isFinite(rails["left"]) ||
    !Number.isFinite(rails["right"])
  ) {
    return invalidField(
      "railWidths",
      "railWidths must be { left: number, right: number }",
      "Send railWidths with numeric left and right pixel widths.",
    );
  }
  if (
    body["lastWorkspaceId"] !== null &&
    typeof body["lastWorkspaceId"] !== "string"
  ) {
    return invalidField(
      "lastWorkspaceId",
      "lastWorkspaceId must be a string or null",
      "Send lastWorkspaceId as a workspace id, or null before any workspace was opened.",
    );
  }
  return valid(body as unknown as LayoutPreference);
}

// ── WebSocket messages ──

/** Inbound WS messages above this size are rejected before parsing. */
export const MAX_WS_MESSAGE_BYTES = 256 * 1024;

export interface ParsedClientMessage {
  message: ClientMessage;
}

export interface ClientMessageRejection {
  error: ApiError;
  /** Echoed when the envelope was parseable enough to carry one. */
  requestId?: string;
}

export type ClientMessageValidation =
  | { ok: true; message: ClientMessage }
  | { ok: false; rejection: ClientMessageRejection };

function rejectMessage(
  error: ApiError,
  requestId?: string,
): ClientMessageValidation {
  return {
    ok: false,
    rejection: { error, ...(requestId !== undefined ? { requestId } : {}) },
  };
}

const ACCEPTED_TYPES_FIX = `Send one of the accepted client message types: ${CLIENT_MESSAGE_TYPES.join(", ")}.`;

function validateChatSend(payload: Record<string, unknown>): Validation<ChatSendPayload> {
  if (typeof payload["text"] !== "string" || payload["text"].trim() === "") {
    return invalidField(
      "payload.text",
      "chat.send requires a non-empty text string",
      "Send payload.text with the user's message.",
    );
  }
  if (payload["artifactId"] !== undefined && !isKebabSlug(payload["artifactId"])) {
    return invalidField(
      "payload.artifactId",
      "artifactId must be a kebab-case slug",
      "Omit artifactId or send a valid artifact id.",
    );
  }
  if (payload["references"] !== undefined && !Array.isArray(payload["references"])) {
    return invalidField(
      "payload.references",
      "references must be an array",
      "Omit references or send the composer's library references as an array.",
    );
  }
  const value: ChatSendPayload = {
    text: payload["text"],
    ...(payload["artifactId"] !== undefined
      ? { artifactId: payload["artifactId"] as string }
      : {}),
    ...(payload["references"] !== undefined
      ? { references: payload["references"] as unknown[] }
      : {}),
  };
  return valid(value);
}

function validateChipUpdate(
  payload: Record<string, unknown>,
): Validation<ChipUpdatePayload> {
  if (typeof payload["messageId"] !== "string" || payload["messageId"] === "") {
    return invalidField(
      "payload.messageId",
      "chip.update requires the messageId of the turn that emitted the chips",
      "Send payload.messageId from the chips.updated event.",
    );
  }
  const kind = payload["kind"];
  if (kind !== "system" && kind !== "layout" && kind !== "platform") {
    return invalidField(
      "payload.kind",
      `"${String(kind)}" is not a chip kind`,
      "Send payload.kind as one of: system, layout, platform.",
    );
  }
  if (typeof payload["value"] !== "string" || payload["value"] === "") {
    return invalidField(
      "payload.value",
      "chip.update requires a non-empty value",
      "Send payload.value as one of the chip's options.",
    );
  }
  return valid({ messageId: payload["messageId"], kind, value: payload["value"] });
}

/**
 * Parse and validate one raw WS message into a typed ClientMessage.
 * Rejections carry the requestId whenever the envelope was parseable.
 */
export function parseClientMessage(raw: string): ClientMessageValidation {
  if (Buffer.byteLength(raw, "utf8") > MAX_WS_MESSAGE_BYTES) {
    return rejectMessage(
      apiError(
        "payload_too_large",
        `the message exceeds ${MAX_WS_MESSAGE_BYTES} bytes`,
        "Send smaller messages; large content belongs on the HTTP surface.",
      ),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return rejectMessage(
      apiError(
        "invalid_message",
        "the message is not valid JSON",
        "Send a JSON envelope: { type, requestId?, payload }.",
      ),
    );
  }
  if (!isRecord(parsed)) {
    return rejectMessage(
      apiError(
        "invalid_message",
        "the message must be a JSON object envelope",
        "Send a JSON envelope: { type, requestId?, payload }.",
      ),
    );
  }

  const requestId =
    typeof parsed["requestId"] === "string" ? parsed["requestId"] : undefined;

  const type = parsed["type"];
  if (
    typeof type !== "string" ||
    !(CLIENT_MESSAGE_TYPES as readonly string[]).includes(type)
  ) {
    return rejectMessage(
      apiError(
        "invalid_message",
        `"${String(type)}" is not an accepted message type`,
        ACCEPTED_TYPES_FIX,
        "type",
      ),
      requestId,
    );
  }

  const payload = parsed["payload"];
  if (!isRecord(payload)) {
    return rejectMessage(
      apiError(
        "invalid_message",
        `${type} requires an object payload`,
        "Send payload as a JSON object matching the contract shape.",
        "payload",
      ),
      requestId,
    );
  }

  const envelope = <T>(value: T): ClientMessageValidation =>
    ({
      ok: true,
      message: {
        type,
        ...(requestId !== undefined ? { requestId } : {}),
        payload: value,
      } as ClientMessage,
    }) as ClientMessageValidation;

  switch (type as ClientMessage["type"]) {
    case "workspace.attach": {
      if (!isKebabSlug(payload["workspaceId"])) {
        return rejectMessage(
          apiError(
            "invalid_message",
            "workspace.attach requires a kebab-case workspaceId",
            "Send payload.workspaceId from GET /api/workspaces.",
            "payload.workspaceId",
          ),
          requestId,
        );
      }
      const lastEventSeq = payload["lastEventSeq"];
      if (
        lastEventSeq !== undefined &&
        (typeof lastEventSeq !== "number" ||
          !Number.isInteger(lastEventSeq) ||
          lastEventSeq < 0)
      ) {
        return rejectMessage(
          apiError(
            "invalid_message",
            "lastEventSeq must be a non-negative integer",
            "Send the last seq the client saw, or omit it for a full re-sync.",
            "payload.lastEventSeq",
          ),
          requestId,
        );
      }
      return envelope({
        workspaceId: payload["workspaceId"],
        ...(lastEventSeq !== undefined ? { lastEventSeq } : {}),
      });
    }
    case "chat.send": {
      const result = validateChatSend(payload);
      return result.ok ? envelope(result.value) : rejectMessage(result.error, requestId);
    }
    case "chat.cancel": {
      if (typeof payload["messageId"] !== "string" || payload["messageId"] === "") {
        return rejectMessage(
          apiError(
            "invalid_message",
            "chat.cancel requires the messageId of the in-flight turn",
            "Send payload.messageId from chat.message_started.",
            "payload.messageId",
          ),
          requestId,
        );
      }
      return envelope({ messageId: payload["messageId"] });
    }
    case "chip.update": {
      const result = validateChipUpdate(payload);
      return result.ok ? envelope(result.value) : rejectMessage(result.error, requestId);
    }
  }
}
