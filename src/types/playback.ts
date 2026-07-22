// Playback domain types.

export interface PlaybackState {
  currentTime: number; // seconds
  isPlaying: boolean;
  duration: number; // total timeline duration (seconds)
}
