# Studio — Architecture Contract

Shared, binding decisions for all capability specs. Capability decomposition
and implementation treat this file as the source of truth for every
cross-capability interface. A capability spec may refine details inside its
own boundary; it may not contradict anything here.

Decisions recorded in `product.yaml` `architecture_decisions` apply:
single-user local-only, plain files only, Claude Agent SDK, dual MCP
connections, API-key-only auth, gitignored workspaces, project-board reads
TRACKER files.

## Stack

- Node >= 20 (dev machine runs 20.19; Fastify 5 and the Agent SDK support it), TypeScript strict, ES modules everywhere, named exports
- Server: Fastify 5 (pino logging is native) + @fastify/websocket
- Client: React 19 + Vite + TypeScript strict
- Agent runtime: `@anthropic-ai/claude-agent-sdk` (TypeScript)
- YAML I/O: the `yaml` package — never hand-rolled parsing
- Tests: vitest on both sides; Testing Library for client components
- Monorepo: npm workspaces

## Monorepo layout

```
apps/studio/
  package.json            # npm workspaces root
  _planning/              # this planning tree
  packages/contract/      # shared TS types: WS messages, HTTP payloads, domain models
  server/                 # Fastify service (infrastructure, data, domain, api capabilities)
  client/                 # Vite SPA (ui capabilities)
  workspaces/             # user data (gitignored)
  .env                    # ANTHROPIC_API_KEY (gitignored)
```

## Data on disk (owned by workspace-store; plain files only)

```
apps/studio/workspaces/
  preferences.yaml                  # panel layout, collapsed state, last workspace
  <workspace-id>/
    workspace.yaml                  # id, name, created, updated, active artifact, settings
    transcript.yaml                 # messages, tool-call records, decision chips
    artifacts/
      <artifact-id>/
        artifact.yaml               # name, system, platform, head version pointer
        versions/
          <NNNN>/                   # zero-padded sequential: 0001, 0002, …
            wireframe.svg
            wireframe.spec.yaml     # as emitted by the generation pipeline
            compliance.yaml         # ds_check_compliance result for this version
            version.yaml            # provenance: parent version, brief, tool, parameters, created
```

- `workspace-id` and `artifact-id`: kebab-case slugs, unique within their parent
- Writes are atomic: write to a temp file in the same directory, then rename
- Soft delete: rename the workspace directory with a `.trash-` prefix (recoverable)
- Nothing outside `apps/studio/workspaces/` is ever written by the store

## Server surface

HTTP (all under `/api`):

| Method | Route | Purpose |
|---|---|---|
| GET | /api/health | process, bridge, store, auth status |
| GET, POST | /api/workspaces | list, create |
| GET, PATCH, DELETE | /api/workspaces/:wsId | read, rename/settings, soft-delete |
| GET | /api/workspaces/:wsId/artifacts | list artifacts |
| GET | /api/workspaces/:wsId/artifacts/:artId | artifact metadata + version list |
| GET | /api/workspaces/:wsId/artifacts/:artId/versions/:n/svg | SVG content |
| GET | /api/workspaces/:wsId/artifacts/:artId/versions/:n/spec | spec.yaml as JSON |
| GET | /api/workspaces/:wsId/artifacts/:artId/versions/:n/compliance | compliance result |
| POST | /api/workspaces/:wsId/artifacts/:artId/versions/:n/restore | restore-as-new-head (undo semantics, delegates to artifact-pipeline) |
| GET, PUT | /api/preferences | panel layout and user prefs |
| GET | /api/library/systems | ds_list_systems |
| GET | /api/library/:systemId/tokens | wf_get_tokens |
| GET | /api/library/:systemId/components | component index |
| GET | /api/library/:systemId/components/:componentId | wf_read_component |
| GET | /api/library/:systemId/layouts | layout templates from the loaded spec |

WebSocket: single endpoint `/ws`, one connection per client; the client
attaches to a workspace by message, not by URL.

Restore returns `RestoreResponse` — the new head's `VersionSummary` (the
canvas needs the new version number for its inline Undo) — and emits
`artifact.version_created` through the normal pipeline path, identical to
generation. The `/api/health` route is owned by studio-server; studio-api
owns every other route.

Library endpoint caching is invalidated by studio-api watching
`systems/registry.yaml` directly (`fs.watch`, path from config) — the
bridge exposes no registry-change signal.

## WebSocket envelope

```json
{ "type": "<domain.event>", "requestId": "<uuid — echoes the client request when applicable>", "seq": 0, "payload": { } }
```

`seq` is server→client only: a monotonic per-workspace sequence number
backing reconnect-with-resume — the client sends the last `seq` it saw on
`workspace.attach`, and the server replays missed events or re-syncs state.
The contract package encodes this as two envelope types: `ClientEnvelope`
(no `seq`) and `ServerEnvelope` (`seq` present) — client code cannot emit a
sequence number by construction.

Client → server: `workspace.attach`, `chat.send`, `chat.cancel`, `chip.update`

Server → client: `chat.message_started`, `chat.assistant_delta`,
`chat.tool_started`, `chat.tool_finished`, `chat.message_completed`,
`chat.error`, `chips.updated`, `artifact.version_created`,
`artifact.compliance_completed`, `bridge.status`, `auth.status`

Every message and payload type is declared once in `packages/contract` and
imported by both server and client. No stringly-typed messages.

Wire shapes for the two seams that cross capability boundaries mid-message:

- `chip.update` carries `{ messageId, kind: ChipKind, value }`. The studio-api
  relay resolves `artifactId` by looking up the `ChipSet` previously emitted
  for that `messageId` (every `ChipSet` carries `{ artifactId, messageId }`),
  then hands agent-orchestration its domain `ChipUpdate`
  `{ requestId, artifactId, kind, value }`. The field is named `kind` on both
  sides.
- `artifact_produced` (agent-orchestration → artifact-pipeline) carries an
  `ArtifactSource` discriminated union:
  `{ kind: "paths", svgPath, specPath }` (wf_generate and
  wf_apply_substitutions emit files to disk) or
  `{ kind: "text", svgText, specYaml? }` (wf_assemble_from_blueprint returns
  SVG text). artifact-pipeline ingestion accepts both.

## Contract package ownership

The package's npm name is `@studio/contract`; its filesystem path is
`apps/studio/packages/contract` — `import { ... } from '@studio/contract'`
resolves there via npm workspaces. The monorepo root and the contract
package skeleton are scaffolded in Wave 1 (studio-server slice 1); each
capability adds its own modules in its own wave. One module has exactly one
owning capability; every other capability imports, never redeclares:

| Module (src/) | Owner | Key types |
|---|---|---|
| envelope.ts | studio-api | ClientEnvelope, ServerEnvelope |
| ws-messages.ts | studio-api | all WS payloads, incl. ChipUpdatePayload, ChatSendPayload |
| http-payloads.ts | studio-api | workspace/artifact payloads, ComplianceResponse, RestoreResponse |
| errors.ts | studio-api | structured error shape |
| health.ts | studio-server | HealthResponse, StatusReport |
| store.ts | workspace-store | storage models, TranscriptRecord, ArtifactMeta |
| bridge.ts | mcp-bridge | BridgeResult, BridgeError, BridgeState, BridgeStatus |
| agent-events.ts | agent-orchestration | AgentEvent, AgentToolName, ChipSet, DecisionChip, ChipUpdate |
| artifact.ts | artifact-pipeline | ArtifactVersion, VersionProvenance, ComplianceReport, ViolationNodeMapping, ArtifactSource |
| preferences.ts | docking-shell | LayoutPreference |
| library.ts | library-panel | LibraryReference |

Canonical resolutions for types that were independently declared during
decomposition — these supersede any conflicting declaration in a capability
spec:

- `BridgeState` = `"starting" | "up" | "restarting" | "failed" | "stopped"`
  (mcp-bridge's five states; consumers handle all five)
- `HealthResponse` = studio-server's shape: `{ status, process: { pid,
  uptimeSeconds, version }, bridge: StatusReport, store: StatusReport,
  auth: StatusReport }` where `StatusReport = { status, detail? }`
- `ComplianceReport` is artifact-pipeline's domain model in `artifact.ts`.
  The HTTP endpoint serves `ComplianceResponse` (studio-api,
  `http-payloads.ts`), a projection with violation `nodeIds` resolved via
  artifact-pipeline's violation-to-node mapping. The raw MCP result shape is
  bridge-internal: `RawComplianceResult` in `apps/studio/server/src/mcp/types.ts`,
  not in the contract package.
- Compliance rule `detail` is `Record<string, unknown>` everywhere above the
  bridge; the bridge parses JSON-string details from the wire into the
  structured form.
- `LayoutPreference` (docking-shell) is the single preferences shape, on the
  wire and on disk. workspace-store persists the document opaquely
  (round-trips it without interpreting fields); studio-api's GET/PUT
  /api/preferences uses `LayoutPreference` directly.
- The artifact head pointer is `headVersion: number | null` (null = no
  versions yet), as stored in `artifact.yaml`.
- `TranscriptRecord.kind` = `"message" | "tool_call" | "decision_chips" |
  "routing_result"`.
- `ChatSendPayload` = `{ text, artifactId?, references?: LibraryReference[] }`
  — the composer attaches library references; the agent receives them as
  grounding.

## SVG sanitization

Two sanitizers, one documented contract:

- **artifact-pipeline** sanitizes artifact version SVGs server-side before
  serving, preserving stable node IDs for violation highlighting.
- **library-panel** sanitizes library component/layout SVGs client-side —
  that content flows `wf_read_component → studio-api → panel` and never
  passes through artifact-pipeline.

Both sanitizers are tested against the same shared adversarial fixture set
(script injection, event handlers, external references). Security claims in
capability specs are scoped accordingly: the canvas guarantee covers
artifact versions; the library guarantee covers library content.

## MCP topology (decided)

Two independent stdio connections to `tools/mcp-server` (launch
command per repo-root `.mcp.json`):

1. **Agent SDK's own connection** (agent-orchestration): `wf_generate`,
   `wf_build_substitution_request`, `wf_apply_substitutions`,
   `wf_assemble_from_blueprint`, `wf_select_layout`, plus any reads the agent
   needs mid-loop.
2. **mcp-bridge** (direct server calls): `ds_list_systems`, `ds_load_system`,
   `ds_get_rulebook`, `ds_check_compliance`, `wf_get_tokens`,
   `wf_read_component`.

The MCP server is stateless per call; dual connections are safe.

## Auth

`ANTHROPIC_API_KEY` only — Anthropic policy prohibits embedded SDK apps from
offering claude.ai subscription login. Resolution order: process environment,
then `apps/studio/.env` (gitignored). `apps/studio/.env` means `<repoRoot>/apps/studio/.env`
— never resolved relative to the process working directory. The key is injected into the Agent SDK
subprocess environment, never logged (pino redaction), and never written into
workspace files. Auth state (`configured` / `missing` / `invalid`) is reported
on `/api/health` and pushed as `auth.status`. Keyless mode degrades
gracefully: library browsing, canvas review, and compliance display work;
generation is disabled with the reason and the fix shown in place.

## Logging and errors

pino structured JSON logs. Correlation: `requestId` per HTTP/WS request,
`connectionId` per WS connection, `workspaceId` wherever applicable. Errors
cross capability seams as typed results, never as thrown exceptions. The UI
surfaces every error in place — no toasts, no console-only errors.

## Testing policy

Real-seam integration tests: mcp-bridge tests run against the actual
design-systems MCP server; workspace-store tests run against a real temp
directory; studio-api tests run over real HTTP/WS connections. Unit tests
cover pure logic. The MCP server is never mocked in bridge tests.
