export type VoiceMode = 'match' | 'male' | 'female';

/**
 * Authentication configuration for vox8 SDK
 *
 * Use ONE of:
 * - `sessionToken`: For browser usage (secure, short-lived token from your backend)
 * - `apiKey`: For server-side/Node.js usage only (NEVER use in browser)
 */
export type Vox8Auth =
  | { sessionToken: string; apiKey?: never }
  | { apiKey: string; sessionToken?: never };

export interface Vox8Config {
  /** WebSocket URL to connect to */
  wsUrl: string;
  /** Target language code (e.g., 'es', 'fr', 'de') */
  targetLanguage: string;
  /** Source language code or 'auto' for detection (default: 'auto') */
  sourceLanguage?: string;
  /** Voice mode: 'match' preserves speaker voice, 'male'/'female' use preset voices (default: 'match') */
  voiceMode?: VoiceMode;
  /**
   * Session token for browser authentication (recommended for browser)
   * Obtain from your backend via POST /v1/session-token
   */
  sessionToken?: string;
  /**
   * API key for server-side authentication (Node.js only)
   * WARNING: Never expose API keys in browser code
   */
  apiKey?: string;
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
