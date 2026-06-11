declare module '@mkkellogg/gaussian-splats-3d' {
  export const SceneFormat: {
    readonly Splat: unknown;
  };

  export const RenderMode: {
    readonly OnChange: unknown;
  };

  export const SceneRevealMode: {
    readonly Instant: unknown;
  };

  export const LogLevel: {
    readonly None: unknown;
  };

  export class Viewer {
    constructor(options?: Record<string, unknown>);

    addSplatScene(path: string, options?: Record<string, unknown>): Promise<unknown>;
    start(): void;
    dispose(): Promise<void> | void;
  }
}
