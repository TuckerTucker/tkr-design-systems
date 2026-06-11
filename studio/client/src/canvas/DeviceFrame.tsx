/**
 * DeviceFrame — platform frame chrome at TRUE device dimensions
 * (375×812 mobile, 1280×800 desktop per architecture.md). The frame
 * content box is exactly the platform size at 100% zoom; the chrome
 * (outline, platform label, dimensions) is visually distinct from the
 * artifact content and never scales the artifact.
 */
import type { ReactElement, ReactNode } from "react";

import type { Platform } from "@studio/contract";

import { PLATFORM_DIMENSIONS } from "./state.js";

export interface DeviceFrameProps {
  platform: Platform;
  children: ReactNode;
}

export function DeviceFrame(props: DeviceFrameProps): ReactElement {
  const { platform, children } = props;
  const dimensions = PLATFORM_DIMENSIONS[platform];
  return (
    <figure className="canvas-device-frame" data-platform={platform}>
      <figcaption className="canvas-frame-label">
        <span className="canvas-frame-platform">{platform}</span>
        <span className="canvas-frame-dimensions">
          {dimensions.width}×{dimensions.height}
        </span>
      </figcaption>
      <div
        className="canvas-frame-content"
        data-testid={`device-frame-${platform}`}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        {children}
      </div>
    </figure>
  );
}
