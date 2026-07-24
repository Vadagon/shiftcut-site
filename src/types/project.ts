// Project domain types.

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  background?: string;
}

export interface TProject {
  id: string;
  name: string;
  /** Durable, model-facing explanation of the complete composition. */
  compositionDescription?: string;
  revision: number; // monotonic; +1 on every mutation (UltraCut contract, see PRD)
  settings: ProjectSettings;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
};
