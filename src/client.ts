import type {
  Vox8Config,
  Vox8Event,
  Vox8EventHandlers,
  TranscriptEvent,
  AudioEvent,
  ErrorEvent,
  SessionReadyEvent,
  SessionCompleteEvent,
} from './types';
import { MicrophoneCapture, AudioPlayer } from './audio';

export type Vox8ClientState = 'disconnected' | 'connecting' | 'ready' | 'error';

/**
 * vox8 client for real-time speech translation
 *
 * SECURITY: For browser usage, always use sessionToken (not apiKey).
 * Get a session token from your backend first.
 *
 * @example Browser usage (secure)
 * ```ts
 * // Your backend calls POST /v1/session-token with your API key
 * // and returns the session token to the browser
 * const { session_token, ws_url } = await fetch('/api/vox8-session').then(r => r.json());
 *
 * const client = new Vox8Client({
 *   wsUrl: ws_url,
 *   sessionToken: session_token,
 *   targetLanguage: 'es',
 * }, {
 *   onTranscript: (evt) => console.log(evt.text, evt.translation),
 * });
 *
 * await client.connect();
 * await client.startMicrophone();
 * ```
 *
 * @example Node.js/server-side usage
 * ```ts
 * const client = new Vox8Client({
 *   wsUrl: 'wss://api.vox8.com',
 *   apiKey: process.env.VOX8_API_KEY, // Safe in Node.js
 *   targetLanguage: 'es',
 * });
 * ```
 */
export class Vox8Client {
  private config: Vox8Config;
  private handlers: Vox8EventHandlers;
  private ws: WebSocket | null = null;
  private sessionReady = false;
  private microphone: MicrophoneCapture | null = null;
  private player: AudioPlayer | null = null;
  private _state: Vox8ClientState = 'disconnected';
  private sessionId: string | null = null;

  constructor(config: Vox8Config, handlers: Vox8EventHandlers = {}) {
    // Validate authentication
    if (!config.sessionToken && !config.apiKey) {
      throw new Error('Either sessionToken or apiKey must be provided');
    }

    // Warn about API key usage in browser (development only)
    if (config.apiKey && typeof window !== 'undefined') {
      console.warn(
        '[vox8] WARNING: Using apiKey in browser is insecure. ' +
        'Use sessionToken instead. Get a session token from your backend.'
      );
    }

    this.config = {
      sourceLanguage: 'auto',
      voiceMode: 'match',
      ...config,
    };
    this.handlers = handlers;
  }

  /**
   * Current connection state
   */
  get state(): Vox8ClientState {
    return this._state;
  }

  /**
   * Whether the session is ready to receive audio
   */
  get isReady(): boolean {
    return this.sessionReady;
  }

  /**
   * Connect to the vox8 API
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        reject(new Error('Already connected'));
        return;
      }

      this._state = 'connecting';
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.onopen = () => {
        // Build session_start message with appropriate auth
        const sessionStart: Record<string, unknown> = {
          type: 'session_start',
          source_language: this.config.sourceLanguage,
          target_language: this.config.targetLanguage,
          voice_mode: this.config.voiceMode,
          audio_format: 'pcm_s16le',
        };

        // Use session token (browser) or API key (server-side)
        if (this.config.sessionToken) {
          sessionStart.session_token = this.config.sessionToken;
        } else if (this.config.apiKey) {
          sessionStart.api_key = this.config.apiKey;
        }

        this.ws!.send(JSON.stringify(sessionStart));
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        this.handleMessage(msg);

        if (msg.type === 'session_ready') {
          this.sessionReady = true;
          this._state = 'ready';
          resolve();
        }
      };

      this.ws.onerror = () => {
        this._state = 'error';
        reject(new Error('WebSocket connection failed'));
      };

      this.ws.onclose = () => {
        this.sessionReady = false;
        this._state = 'disconnected';
        this.ws = null;
      };
    });
  }

  /**
   * Disconnect from the vox8 API
   */
  disconnect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'session_end' }));
    }
    this.stopMicrophone();
    this.stopPlayback();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.sessionReady = false;
    this._state = 'disconnected';
  }

  /**
   * Send raw audio data (base64-encoded PCM)
   */
  sendAudio(audioBase64: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.sessionReady) {
      return;
    }

    this.ws.send(
      JSON.stringify({
        type: 'audio',
        audio: audioBase64,
      })
    );
  }

  /**
   * Send a keepalive message to prevent session timeout
   */
  sendKeepalive(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    this.ws.send(JSON.stringify({ type: 'keepalive' }));
  }

  /**
   * Start capturing audio from the microphone and sending it to vox8
   */
  async startMicrophone(): Promise<void> {
    if (this.microphone) {
      return;
    }

    this.microphone = new MicrophoneCapture();
    await this.microphone.start((audioBase64) => {
      this.sendAudio(audioBase64);
    });
  }

  /**
   * Stop capturing audio from the microphone
   */
  stopMicrophone(): void {
    if (this.microphone) {
      this.microphone.stop();
      this.microphone = null;
    }
  }

  /**
   * Start automatic playback of received audio
   */
  startPlayback(): void {
    if (!this.player) {
      this.player = new AudioPlayer();
    }
  }

  /**
   * Stop audio playback and clear the queue
   */
  stopPlayback(): void {
    if (this.player) {
      this.player.close();
      this.player = null;
    }
  }

  /**
   * Queue audio for playback (automatically starts playback if not already playing)
   */
  playAudio(audioBase64: string): void {
    if (!this.player) {
      this.player = new AudioPlayer();
    }
    this.player.enqueue(audioBase64);
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case 'session_ready': {
        this.sessionId = msg.session_id as string;
        const event: SessionReadyEvent = {
          type: 'session_ready',
          sessionId: this.sessionId,
        };
        this.handlers.onSessionReady?.(event);
        break;
      }

      case 'transcript': {
        const event: TranscriptEvent = {
          type: 'transcript',
          text: msg.text as string,
          isFinal: msg.is_final as boolean,
          translation: msg.translation as string | undefined,
        };
        this.handlers.onTranscript?.(event);
        break;
      }

      case 'audio': {
        const event: AudioEvent = {
          type: 'audio',
          audio: msg.audio as string,
          sequence: msg.sequence as number,
          originalText: msg.original_text as string,
          translatedText: msg.translated_text as string,
        };
        this.handlers.onAudio?.(event);

        // Auto-play if playback is enabled
        if (this.player) {
          this.player.enqueue(event.audio);
        }
        break;
      }

      case 'error': {
        const event: ErrorEvent = {
          type: 'error',
          code: msg.code as string,
          message: msg.message as string,
          fatal: msg.fatal as boolean,
        };
        this.handlers.onError?.(event);

        if (event.fatal) {
          this._state = 'error';
        }
        break;
      }

      case 'session_complete': {
        const event: SessionCompleteEvent = {
          type: 'session_complete',
        };
        this.handlers.onSessionComplete?.(event);
        break;
      }
    }
  }
}
