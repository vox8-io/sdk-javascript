# @vox8/sdk

JavaScript SDK for vox8 real-time speech translation.

## Installation

```bash
npm install @vox8/sdk
```

## Usage

**Security note:** Never expose your API key in client-side code. Use a backend endpoint to provide credentials to the SDK.

### Basic example

```typescript
import { Vox8Client } from '@vox8/sdk';

// 1. Get credentials from your backend (keeps API key secure)
const { wsUrl, apiKey } = await fetch('/api/vox8-session').then(r => r.json());

// 2. Create client with event handlers
const client = new Vox8Client(
  {
    wsUrl,
    apiKey,
    targetLanguage: 'es',
    sourceLanguage: 'auto', // optional, defaults to 'auto'
    voiceMode: 'match',     // optional, defaults to 'match'
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

// 3. Connect to vox8
await client.connect();

// 4. Start microphone capture and audio playback
await client.startMicrophone();
client.startPlayback();

// 5. Stop when done
client.disconnect();
```

### Manual audio handling

If you need more control over audio capture and playback:

```typescript
import { Vox8Client, MicrophoneCapture, AudioPlayer } from '@vox8/sdk';

const client = new Vox8Client({ wsUrl, apiKey, targetLanguage: 'es' });
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

### Backend session endpoint example

```typescript
// /api/vox8-session.ts (Next.js example)
export async function GET() {
  return Response.json({
    wsUrl: process.env.VOX8_WS_URL,
    apiKey: process.env.VOX8_API_KEY,
  });
}
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
| `apiKey` | string | Yes | - | API key |
| `targetLanguage` | string | Yes | - | Target language code |
| `sourceLanguage` | string | No | 'auto' | Source language code |
| `voiceMode` | 'match' \| 'male' \| 'female' | No | 'match' | Voice mode |

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
