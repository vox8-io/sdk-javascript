# @vox8/sdk

JavaScript SDK for vox8 real-time speech translation.

## Installation

```bash
npm install @vox8/sdk
```

## Authentication

The SDK supports two authentication methods:

| Method | Use case | Security |
|--------|----------|----------|
| `sessionToken` | Browser/frontend apps | Secure - short-lived token from your backend |
| `apiKey` | Node.js/server-side | API key stays on server |

**Never expose your API key in browser code.** For browser apps, use session tokens.

## Browser usage (recommended)

For browser apps, get a session token from your backend first:

```typescript
import { Vox8Client } from '@vox8/sdk';

// 1. Get session token from your backend
const { session_token, ws_url } = await fetch('/api/vox8-session').then(r => r.json());

// 2. Create client with session token
const client = new Vox8Client(
  {
    wsUrl: ws_url,
    sessionToken: session_token,  // Secure: short-lived token
    targetLanguage: 'es',
  },
  {
    onTranscript: (evt) => {
      console.log('Original:', evt.text);
      if (evt.isFinal && evt.translation) {
        console.log('Translation:', evt.translation);
      }
    },
    onAudio: (evt) => {
      console.log('Received audio for:', evt.translatedText);
    },
    onError: (evt) => {
      console.error('Error:', evt.message);
    },
  }
);

// 3. Connect and start
await client.connect();
await client.startMicrophone();
client.startPlayback();

// 4. Stop when done
client.disconnect();
```

### Backend endpoint (Next.js example)

Your backend exchanges the API key for a session token:

```typescript
// /api/vox8-session/route.ts
export async function POST() {
  // Call vox8 API to get session token (keeps API key secure)
  const response = await fetch('https://api.vox8.io/v1/session-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.VOX8_API_KEY }),
  });

  const { session_token, expires_in } = await response.json();

  return Response.json({
    session_token,
    ws_url: process.env.VOX8_WS_URL || 'wss://api.vox8.io/v1/translate',
  });
}
```

## Node.js usage

For server-side apps, you can use the API key directly:

```typescript
import { Vox8Client } from '@vox8/sdk';

const client = new Vox8Client({
  wsUrl: 'wss://api.vox8.io/v1/translate',
  apiKey: process.env.VOX8_API_KEY,  // Safe in Node.js
  targetLanguage: 'es',
});

await client.connect();
// Send audio...
client.disconnect();
```

## Manual audio handling

If you need more control over audio capture and playback:

```typescript
import { Vox8Client, MicrophoneCapture, AudioPlayer } from '@vox8/sdk';

const client = new Vox8Client({
  wsUrl,
  sessionToken,
  targetLanguage: 'es',
});
await client.connect();

// Manual microphone capture
const mic = new MicrophoneCapture();
await mic.start((audioBase64) => {
  client.sendAudio(audioBase64);
});

// Manual audio playback
const player = new AudioPlayer();
client.onAudio = (evt) => {
  player.enqueue(evt.audio);
};

// Cleanup
mic.stop();
player.close();
client.disconnect();
```

## API

### Vox8Client

Main client class for connecting to vox8.

#### Constructor

```typescript
new Vox8Client(config: Vox8Config, handlers?: Vox8EventHandlers)
```

#### Config options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `wsUrl` | string | Yes | - | WebSocket URL |
| `sessionToken` | string | * | - | Session token (for browser) |
| `apiKey` | string | * | - | API key (for Node.js) |
| `targetLanguage` | string | Yes | - | Target language code |
| `sourceLanguage` | string | No | 'auto' | Source language code |
| `voiceMode` | 'match' \| 'male' \| 'female' | No | 'match' | Voice mode |

\* Either `sessionToken` or `apiKey` is required.

#### Methods

- `connect(): Promise<void>` - Connect to vox8
- `disconnect(): void` - Disconnect and cleanup
- `sendAudio(base64: string): void` - Send audio data
- `sendKeepalive(): void` - Prevent session timeout
- `startMicrophone(): Promise<void>` - Start mic capture
- `stopMicrophone(): void` - Stop mic capture
- `startPlayback(): void` - Enable auto-playback
- `stopPlayback(): void` - Disable auto-playback
- `playAudio(base64: string): void` - Queue audio for playback

#### Properties

- `state: 'disconnected' | 'connecting' | 'ready' | 'error'`
- `isReady: boolean`

### Event handlers

| Handler | Event type | Description |
|---------|------------|-------------|
| `onTranscript` | TranscriptEvent | Speech recognized |
| `onAudio` | AudioEvent | Translated audio received |
| `onError` | ErrorEvent | Error occurred |
| `onSessionReady` | SessionReadyEvent | Session started |
| `onSessionComplete` | SessionCompleteEvent | Session ended |

## License

MIT
