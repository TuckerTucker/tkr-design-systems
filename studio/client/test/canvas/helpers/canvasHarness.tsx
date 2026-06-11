/**
 * Canvas component-test harness — a deterministic in-memory CanvasApi
 * (serving the REAL fixture SVG/spec content), a render helper composing
 * CanvasPanel inside a real ShellStateProvider over the fake socket, and
 * a focus bridge exposing the shell's focusArtifact seam to tests.
 */
import { render, type RenderResult } from "@testing-library/react";
import { useEffect, type ReactElement } from "react";

import type {
  ApiError,
  ArtifactDetail,
  ArtifactSummary,
  ParsedSpecMetadata,
  RestoreResponse,
  VersionSummary,
} from "@studio/contract";

import { ShellStateProvider, useShellState } from "../../../src/app/shellState.jsx";
import { CanvasPanel } from "../../../src/canvas/CanvasPanel.jsx";
import type {
  CanvasApi,
  CanvasResult,
  ComplianceFetchResult,
} from "../../../src/canvas/api.js";
import { createWorkspaceHistory } from "../../../src/routing/workspaceRoutes.js";
import {
  createFakeApi,
  createFakeSocket,
  workspaceSummary,
  type FakeApi,
  type FakeStudioSocket,
} from "../../unit/helpers/fakes.js";
import {
  ASSEMBLED_SVG_TEXT,
  assembledSpec,
  versionSummary,
} from "./fixtures.js";

export const WS_ID = "ws-1";

function notFound(what: string): ApiError {
  return {
    code: "artifact_not_found",
    message: `${what} was not found.`,
    fix: "Check the id and retry.",
  };
}

export interface FakeCanvasApi extends CanvasApi {
  artifacts: ArtifactSummary[];
  details: Map<string, ArtifactDetail>;
  /** `${artifactId}/${version}` → SVG text. */
  svgs: Map<string, string>;
  specs: Map<string, ParsedSpecMetadata>;
  compliance: Map<string, ComplianceFetchResult>;
  /** Force errors for specific svg keys. */
  failSvg: Map<string, ApiError>;
  listError: ApiError | null;
  restoreCalls: Array<{ artifactId: string; version: number }>;
  restoreError: ApiError | null;
  /** Land a new version on an artifact (simulating the pipeline). */
  landVersion(artifactId: string, summary: VersionSummary, svgText: string): void;
}

export function createFakeCanvasApi(): FakeCanvasApi {
  const fake: FakeCanvasApi = {
    artifacts: [],
    details: new Map(),
    svgs: new Map(),
    specs: new Map(),
    compliance: new Map(),
    failSvg: new Map(),
    listError: null,
    restoreCalls: [],
    restoreError: null,

    landVersion(artifactId, summary, svgText): void {
      const detail = fake.details.get(artifactId);
      if (detail === undefined) {
        throw new Error(`no detail seeded for ${artifactId}`);
      }
      detail.versions = [...detail.versions, summary];
      detail.headVersion = summary.number;
      const summaryEntry = fake.artifacts.find((a) => a.id === artifactId);
      if (summaryEntry !== undefined) {
        summaryEntry.headVersion = summary.number;
      }
      fake.svgs.set(`${artifactId}/${summary.number}`, svgText);
    },

    async listArtifacts(): Promise<CanvasResult<ArtifactSummary[]>> {
      if (fake.listError !== null) {
        return { ok: false, error: fake.listError };
      }
      return { ok: true, value: fake.artifacts.map((a) => ({ ...a })) };
    },

    async getArtifactDetail(
      _workspaceId,
      artifactId,
    ): Promise<CanvasResult<ArtifactDetail>> {
      const detail = fake.details.get(artifactId);
      if (detail === undefined) {
        return { ok: false, error: notFound(`Artifact ${artifactId}`) };
      }
      return {
        ok: true,
        value: { ...detail, versions: [...detail.versions] },
      };
    },

    async getVersionSvg(
      _workspaceId,
      artifactId,
      version,
    ): Promise<CanvasResult<string>> {
      const key = `${artifactId}/${version}`;
      const forced = fake.failSvg.get(key);
      if (forced !== undefined) {
        return { ok: false, error: forced };
      }
      const svg = fake.svgs.get(key);
      if (svg === undefined) {
        return { ok: false, error: notFound(`SVG for ${key}`) };
      }
      return { ok: true, value: svg };
    },

    async getVersionSpec(
      _workspaceId,
      artifactId,
      version,
    ): Promise<CanvasResult<ParsedSpecMetadata>> {
      const spec = fake.specs.get(`${artifactId}/${version}`);
      if (spec === undefined) {
        return { ok: false, error: notFound(`Spec for ${artifactId}/${version}`) };
      }
      return { ok: true, value: spec };
    },

    async getVersionCompliance(
      _workspaceId,
      artifactId,
      version,
    ): Promise<ComplianceFetchResult> {
      return (
        fake.compliance.get(`${artifactId}/${version}`) ?? { kind: "pending" }
      );
    },

    async restoreVersion(
      _workspaceId,
      artifactId,
      version,
    ): Promise<CanvasResult<RestoreResponse>> {
      fake.restoreCalls.push({ artifactId, version });
      if (fake.restoreError !== null) {
        return { ok: false, error: fake.restoreError };
      }
      const detail = fake.details.get(artifactId);
      if (detail === undefined) {
        return { ok: false, error: notFound(`Artifact ${artifactId}`) };
      }
      const head = detail.headVersion ?? 0;
      const restored = versionSummary(head + 1, {
        parent: head,
        tool: "restore",
        brief: `restore of v${version}`,
      });
      const svgText = fake.svgs.get(`${artifactId}/${version}`) ?? ASSEMBLED_SVG_TEXT;
      fake.landVersion(artifactId, restored, svgText);
      return { ok: true, value: restored };
    },
  };
  return fake;
}

/** Seed one assembled-fixture artifact with `versions` head-linear versions. */
export function seedAssembledArtifact(
  api: FakeCanvasApi,
  options: {
    id?: string;
    name?: string;
    platform?: "mobile" | "desktop";
    versions?: number;
  } = {},
): ArtifactSummary {
  const id = options.id ?? "dash-desktop";
  const versions = options.versions ?? 1;
  const summary: ArtifactSummary = {
    id,
    name: options.name ?? "Dashboard",
    system: "swiss",
    platform: options.platform ?? "desktop",
    headVersion: versions,
  };
  api.artifacts.push(summary);
  api.details.set(id, {
    ...summary,
    versions: Array.from({ length: versions }, (_, index) =>
      versionSummary(index + 1),
    ),
  });
  for (let v = 1; v <= versions; v += 1) {
    api.svgs.set(`${id}/${v}`, ASSEMBLED_SVG_TEXT);
    api.specs.set(`${id}/${v}`, assembledSpec());
  }
  return summary;
}

export interface CanvasRender extends RenderResult {
  socket: FakeStudioSocket;
  canvasApi: FakeCanvasApi;
  focusArtifact(artifactId: string | null): void;
}

function FocusBridge(props: {
  onReady: (focus: (artifactId: string | null) => void) => void;
}): null {
  const { focusArtifact } = useShellState();
  const { onReady } = props;
  useEffect(() => {
    onReady(focusArtifact);
  }, [focusArtifact, onReady]);
  return null;
}

export function renderCanvas(options: {
  canvasApi: FakeCanvasApi;
  socket?: FakeStudioSocket;
  workspaceId?: string | null;
}): CanvasRender {
  const socket = options.socket ?? createFakeSocket();
  const workspaceId =
    options.workspaceId === undefined ? WS_ID : options.workspaceId;
  const shellApi = createFakeApi({
    workspaces: workspaceId !== null ? [workspaceSummary(workspaceId)] : [],
  });
  let focus: (artifactId: string | null) => void = () => undefined;
  const ui: ReactElement = (
    <CanvasShell
      socket={socket}
      shellApi={shellApi}
      workspaceId={workspaceId}
      canvasApi={options.canvasApi}
      onFocusReady={(f) => {
        focus = f;
      }}
    />
  );
  const result = render(ui);
  return Object.assign(result, {
    socket,
    canvasApi: options.canvasApi,
    focusArtifact: (artifactId: string | null) => focus(artifactId),
  });
}

function CanvasShell(props: {
  socket: FakeStudioSocket;
  shellApi: FakeApi;
  workspaceId: string | null;
  canvasApi: FakeCanvasApi;
  onFocusReady: (focus: (artifactId: string | null) => void) => void;
}): ReactElement {
  return (
    <ShellStateProvider
      socket={props.socket}
      api={props.shellApi}
      history={createWorkspaceHistory()}
      initialWorkspaceId={props.workspaceId}
    >
      <FocusBridge onReady={props.onFocusReady} />
      <CanvasPanel api={props.canvasApi} />
    </ShellStateProvider>
  );
}
