export type VoiceMode = 'match' | 'male' | 'female';

export interface Vox8Config {
  /** WebSocket URL to connect to */
  wsUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Target language code (e.g., 'es', 'fr', 'de') */
  targetLanguage: string;
  /** Source language code or 'auto' for detection (default: 'auto') */
  sourceLanguage?: string;
  /** Voice mode: 'match' preserves speaker voice, 'male'/'female' use preset voices (default: 'match') */
  voiceMode?: VoiceMode;
}

export interface TranscriptEvent {
  type: 'transcript';
  text: string;
  isFinal: boolean;
  translation?: string;
}

export interface AudioEvent {
  type: 'audio';
  audio: string;
  sequence: number;
  originalText: string;
  translatedText: string;
}

export interface ErrorEvent {
  type: 'error';
  code: string;
  message: string;
  fatal: boolean;
}

export interface SessionReadyEvent {
  type: 'session_ready';
  sessionId: string;
}

export interface SessionCompleteEvent {
  type: 'session_complete';
}

export type Vox8Event =
  | TranscriptEvent
  | AudioEvent
  | ErrorEvent
  | SessionReadyEvent
  | SessionCompleteEvent;

export interface Vox8EventHandlers {
  onTranscript?: (event: TranscriptEvent) => void;
  onAudio?: (event: AudioEvent) => void;
  onError?: (event: ErrorEvent) => void;
  onSessionReady?: (event: SessionReadyEvent) => void;
  onSessionComplete?: (event: SessionCompleteEvent) => void;
}
