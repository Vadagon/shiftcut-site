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
  revision: number; // monotonic; +1 on every mutation (ShiftCut contract, see PRD)
  settings: ProjectSettings;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
};
