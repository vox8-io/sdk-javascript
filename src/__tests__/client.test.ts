import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Vox8Client } from '../client';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sentMessages: string[] = [];

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  simulateMessage(data: object) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

// @ts-ignore
global.WebSocket = MockWebSocket;

describe('Vox8Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws if no auth provided', () => {
      expect(() => {
        new Vox8Client({
          wsUrl: 'wss://test.com',
          targetLanguage: 'es',
        });
      }).toThrow('Either sessionToken or apiKey must be provided');
    });

    it('accepts sessionToken', () => {
      const client = new Vox8Client({
        wsUrl: 'wss://test.com',
        targetLanguage: 'es',
        sessionToken: 'test-token',
      });
      expect(client.state).toBe('disconnected');
    });

    it('accepts apiKey', () => {
      const client = new Vox8Client({
        wsUrl: 'wss://test.com',
        targetLanguage: 'es',
        apiKey: 'test-api-key',
      });
      expect(client.state).toBe('disconnected');
    });

    it('warns when using apiKey in browser', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Simulate browser environment
      // @ts-ignore
      global.window = {};

      new Vox8Client({
        wsUrl: 'wss://test.com',
        targetLanguage: 'es',
        apiKey: 'test-api-key',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARNING: Using apiKey in browser is insecure')
      );

      // Clean up
      // @ts-ignore
      delete global.window;
      warnSpy.mockRestore();
    });
  });

  describe('connect', () => {
    it('sends session_start with sessionToken', async () => {
      const client = new Vox8Client({
        wsUrl: 'wss://test.com',
        targetLanguage: 'es',
        sessionToken: 'my-session-token',
      });

      const connectPromise = client.connect();

      // Wait for WebSocket to open
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get the mock WebSocket instance
      // @ts-ignore
      const ws = client['ws'] as MockWebSocket;

      // Simulate session_ready response
      ws.simulateMessage({ type: 'session_ready', session_id: 'sess-123' });

      await connectPromise;

      const sentMessage = JSON.parse(ws.sentMessages[0]);
      expect(sentMessage.type).toBe('session_start');
      expect(sentMessage.session_token).toBe('my-session-token');
      expect(sentMessage.api_key).toBeUndefined();
      expect(sentMessage.target_language).toBe('es');
    });

    it('sends session_start with apiKey', async () => {
      const client = new Vox8Client({
        wsUrl: 'wss://test.com',
        targetLanguage: 'fr',
        apiKey: 'my-api-key',
      });

      const connectPromise = client.connect();

      await new Promise(resolve => setTimeout(resolve, 10));

      // @ts-ignore
      const ws = client['ws'] as MockWebSocket;
      ws.simulateMessage({ type: 'session_ready', session_id: 'sess-123' });

      await connectPromise;

      const sentMessage = JSON.parse(ws.sentMessages[0]);
      expect(sentMessage.type).toBe('session_start');
      expect(sentMessage.api_key).toBe('my-api-key');
      expect(sentMessage.session_token).toBeUndefined();
      expect(sentMessage.target_language).toBe('fr');
    });

    it('uses default sourceLanguage and voiceMode', async () => {
      const client = new Vox8Client({
        wsUrl: 'wss://test.com',
        targetLanguage: 'es',
        sessionToken: 'token',
      });

      const connectPromise = client.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // @ts-ignore
      const ws = client['ws'] as MockWebSocket;
      ws.simulateMessage({ type: 'session_ready', session_id: 'sess-123' });

      await connectPromise;

      const sentMessage = JSON.parse(ws.sentMessages[0]);
      expect(sentMessage.source_language).toBe('auto');
      expect(sentMessage.voice_mode).toBe('match');
    });
  });

  describe('event handlers', () => {
    it('calls onTranscript handler', async () => {
      const onTranscript = vi.fn();
      const client = new Vox8Client(
        { wsUrl: 'wss://test.com', targetLanguage: 'es', sessionToken: 'token' },
        { onTranscript }
      );

      const connectPromise = client.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // @ts-ignore
      const ws = client['ws'] as MockWebSocket;
      ws.simulateMessage({ type: 'session_ready', session_id: 'sess-123' });
      await connectPromise;

      ws.simulateMessage({
        type: 'transcript',
        text: 'Hello',
        is_final: true,
        translation: 'Hola',
      });

      expect(onTranscript).toHaveBeenCalledWith({
        type: 'transcript',
        text: 'Hello',
        isFinal: true,
        translation: 'Hola',
      });
    });

    it('calls onError handler', async () => {
      const onError = vi.fn();
      const client = new Vox8Client(
        { wsUrl: 'wss://test.com', targetLanguage: 'es', sessionToken: 'token' },
        { onError }
      );

      const connectPromise = client.connect();
      await new Promise(resolve => setTimeout(resolve, 10));

      // @ts-ignore
      const ws = client['ws'] as MockWebSocket;
      ws.simulateMessage({ type: 'session_ready', session_id: 'sess-123' });
      await connectPromise;

      ws.simulateMessage({
        type: 'error',
        code: 'invalid_api_key',
        message: 'Invalid API key',
        fatal: true,
      });

      expect(onError).toHaveBeenCalledWith({
        type: 'error',
        code: 'invalid_api_key',
        message: 'Invalid API key',
        fatal: true,
      });
      expect(client.state).toBe('error');
    });
  });
});
