# Tech Stack Integration: Deepgram + Llama 3.3-70B + Azure TTS

## Stack Overview

```
┌───────────────────────────────────────────────────────────┐
│                    AUDIO INPUT                             │
│              Deepgram Nova-3 STT                          │
│  • <300ms latency • 50% better WER • Streaming           │
└─────────────────────┬─────────────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────────────┐
│                 REASONING ENGINE                           │
│              Llama 3.3-70B Instruct                       │
│  • Function calling • Strong reasoning • Cost-effective   │
└─────────────────────┬─────────────────────────────────────┘
                      │
                      ▼
┌───────────────────────────────────────────────────────────┐
│                   AUDIO OUTPUT                             │
│              Azure Neural TTS                             │
│  • <100ms TTFB • Natural voices • SSML support           │
└───────────────────────────────────────────────────────────┘
```

## 1. Deepgram Integration (STT)

### Why Deepgram Nova-3?

**Performance**:
- <300ms latency (industry-leading)
- 50% lower Word Error Rate vs competitors
- Excellent with accented English (critical for ESL learners)

**Features**:
- Streaming with interim results
- Word-level timestamps and confidence scores
- Smart formatting (numbers, emails, etc.)
- Filler word detection ("um", "uh")
- Multi-language support

### Setup

**Installation**:
```bash
npm install @deepgram/sdk
```

**Configuration**:
```typescript
import { createClient } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const DEEPGRAM_CONFIG = {
  model: 'nova-3',
  language: 'en', // or user's target language
  smart_format: true,
  interim_results: true,
  endpointing: 200, // ms of silence = end of utterance
  punctuate: true,
  diarize: false, // single speaker
  filler_words: true, // track "um", "uh" for fluency analysis
  utterance_end_ms: 1000, // finalize after 1s silence
  keywords: [], // boost recognition of specific words if needed
};
```

### Streaming Implementation

**WebSocket-based streaming**:
```typescript
async function streamAudioToDeepgram(
  audioStream: AsyncIterable<Buffer>,
  onTranscript: (transcript: DeepgramTranscript) => void,
  onError: (error: Error) => void
) {
  try {
    const connection = deepgram.listen.live(DEEPGRAM_CONFIG);

    // Handle connection events
    connection.on('open', () => {
      console.log('Deepgram connection opened');
    });

    connection.on('Results', (data) => {
      const transcript = data.channel.alternatives[0];

      // Only process final results for the agent
      if (data.is_final && transcript.transcript.trim().length > 0) {
        onTranscript({
          text: transcript.transcript,
          confidence: transcript.confidence,
          words: transcript.words, // Word-level data for pronunciation analysis
          isFinal: true,
        });
      } else if (data.is_final === false) {
        // Interim results - can show to user for visual feedback
        onTranscript({
          text: transcript.transcript,
          confidence: transcript.confidence,
          isFinal: false,
        });
      }
    });

    connection.on('error', (err) => {
      onError(new Error(`Deepgram error: ${err}`));
    });

    connection.on('close', () => {
      console.log('Deepgram connection closed');
    });

    // Stream audio chunks to Deepgram
    for await (const audioChunk of audioStream) {
      if (connection.getReadyState() === 1) { // OPEN
        connection.send(audioChunk);
      }
    }

    // Send close signal when done
    connection.finish();

  } catch (error) {
    onError(error);
  }
}
```

### Pronunciation Analysis with Word-Level Data

```typescript
interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  punctuated_word: string;
}

function analyzePronunciation(
  targetPhrase: string,
  deepgramWords: DeepgramWord[]
): PronunciationAnalysis {
  const targetWords = targetPhrase.toLowerCase().split(' ');
  const spokenWords = deepgramWords.map(w => w.word.toLowerCase());

  const analysis = {
    accuracy: 0,
    issues: [],
    wordDetails: [],
  };

  for (let i = 0; i < targetWords.length; i++) {
    const target = targetWords[i];
    const spoken = spokenWords[i];
    const confidence = deepgramWords[i]?.confidence || 0;

    if (target === spoken && confidence > 0.9) {
      analysis.wordDetails.push({
        word: target,
        quality: 'excellent',
        confidence,
      });
    } else if (target === spoken && confidence > 0.7) {
      analysis.wordDetails.push({
        word: target,
        quality: 'good',
        confidence,
      });
    } else {
      analysis.wordDetails.push({
        word: target,
        quality: 'needs_practice',
        confidence,
        spoken: spoken,
      });

      analysis.issues.push({
        target,
        spoken,
        suggestion: getPronunciationSuggestion(target, spoken),
      });
    }
  }

  analysis.accuracy = analysis.wordDetails.filter(w => w.quality !== 'needs_practice').length / targetWords.length;

  return analysis;
}
```

### Cost Optimization

**Pricing** (as of 2024):
- Nova-3: $0.0043/minute (streaming)
- Typical 10-minute session: $0.043

**Optimization strategies**:
1. **Client-side VAD**: Use Silero VAD to only send audio when user is speaking
2. **Connection pooling**: Reuse WebSocket connections
3. **Batch non-real-time**: For asynchronous review, use batch API ($0.0036/min)

```typescript
// Client-side VAD to reduce audio sent
import { PvSpeech, VoiceActivityDetector } from '@picovoice/web-voice-processor';

const vad = await VoiceActivityDetector.create({
  onVoiceActivity: (isActive) => {
    if (isActive) {
      startStreamingToDeepgram();
    } else {
      pauseStreamingToDeepgram();
    }
  }
});
```

## 2. Llama 3.3-70B Integration (LLM)

### Why Llama 3.3-70B?

**Capabilities**:
- Strong function calling (better than 3.1)
- Good reasoning for educational decisions
- JSON output support
- Multi-turn conversation handling

**Cost-Effectiveness**:
- ~$0.50-1.00 per million tokens (via providers)
- Can run on-prem with quantized versions (4-bit or 8-bit)
- Significantly cheaper than GPT-4

**Performance**:
- Competitive with GPT-3.5-Turbo
- <500ms time-to-first-token (with good infrastructure)

### Deployment Options

#### Option 1: Hosted API (Recommended for MVP)
```typescript
// Using Together.ai, Replicate, or similar
import Together from 'together-ai';

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY
});

async function callLlama(messages: Message[], tools: Tool[]) {
  const response = await together.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages,
    tools,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 1000,
    stream: true, // Stream for lower latency
  });

  return response;
}
```

**Providers**:
- Together.ai: ~$0.88/M tokens
- Replicate: ~$1.00/M tokens
- Groq: Free tier, then pay-as-you-go (very fast inference)

#### Option 2: Self-Hosted (For Scale)
```bash
# Using vLLM for optimized inference
pip install vllm

# Run quantized 4-bit model (fits in 24GB VRAM)
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.3-70B-Instruct-AWQ \
  --quantization awq \
  --dtype half \
  --max-model-len 4096 \
  --gpu-memory-utilization 0.95
```

**Self-hosting costs**:
- AWS g5.12xlarge (4x A10G): ~$5/hour
- Can serve ~50-100 concurrent users
- Break-even at ~5M tokens/day

### Function Calling Implementation

**System Prompt for Educational Agent**:
```typescript
const SYSTEM_PROMPT = `You are an expert ESL tutor specializing in personalized language learning. You are warm, encouraging, and pedagogically sophisticated.

# YOUR CAPABILITIES
You can use tools to:
- Check what vocabulary the student knows
- Generate personalized practice materials
- Schedule spaced repetition reviews
- Track pronunciation progress
- Adjust difficulty dynamically
- Celebrate achievements

# PEDAGOGICAL PRINCIPLES
1. Zone of Proximal Development: Keep difficulty just above current level
2. Spaced Repetition: Use research-backed intervals (7, 14, 28 days)
3. Encouragement: Be supportive, especially when students struggle
4. Personalization: Use student's interests, goals, and history
5. Metacognition: Help students understand their own learning

# TOOL USAGE GUIDELINES
- Always check vocabulary before generating practice (avoid frustration)
- Schedule reviews immediately after introducing new words
- Track pronunciation attempts to show progress over time
- Adjust difficulty when you see patterns (3+ struggles = easier, 5+ successes = harder)
- Celebrate milestones genuinely

# CONVERSATION STYLE
- Natural and conversational, not robotic
- Use student's name occasionally
- Reference past conversations ("Last time you mentioned...")
- Be concise in speech (user is listening, not reading)
- Ask questions to engage, not just lecture`;

const messages = [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: userContext }, // From memory retrieval
  { role: "user", content: currentMessage },
];
```

**Streaming with Function Calling**:
```typescript
async function* streamLlamaResponse(messages: Message[], tools: Tool[]) {
  const stream = await together.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages,
    tools,
    tool_choice: "auto",
    stream: true,
  });

  let functionCalls = [];
  let textResponse = '';

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta;

    if (delta?.tool_calls) {
      // Model wants to call tools
      functionCalls.push(...delta.tool_calls);
    }

    if (delta?.content) {
      // Model is generating text
      textResponse += delta.content;
      yield { type: 'text', content: delta.content };
    }
  }

  if (functionCalls.length > 0) {
    yield { type: 'function_calls', calls: functionCalls };
  }
}
```

### Optimizing Latency

**1. Prompt Caching** (if provider supports):
```typescript
// Cache system prompt and user profile (changes rarely)
const cachedPrefix = {
  role: "system",
  content: SYSTEM_PROMPT + userProfile,
  cache_control: { type: "ephemeral" } // Provider-specific
};
```

**2. Temperature = 0 for function calls**:
```typescript
// Lower temperature for more consistent tool usage
if (needsToolCall) {
  temperature = 0.0;
} else {
  temperature = 0.7; // More creative for conversation
}
```

**3. Token Limits**:
```typescript
// Shorter max_tokens for faster responses
const max_tokens = isFunctionCall ? 500 : 200; // Function calls need more reasoning
```

## 3. Azure TTS Integration (Text-to-Speech)

### Why Azure Neural TTS?

**Quality**:
- Highly natural neural voices
- Emotion/style control
- SSML support for precise control
- Multi-language, accent options

**Performance**:
- <100ms time-to-first-byte (streaming)
- Low latency with WebSocket
- Sentence-level streaming

**Features**:
- Custom voice creation (for brand consistency)
- Pronunciation control via SSML
- Speech rate adjustment (important for ESL)

### Setup

**Installation**:
```bash
npm install microsoft-cognitiveservices-speech-sdk
```

**Configuration**:
```typescript
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const speechConfig = sdk.SpeechConfig.fromSubscription(
  process.env.AZURE_SPEECH_KEY,
  process.env.AZURE_SPEECH_REGION
);

// Voice selection (should be user-configurable)
const VOICE_CONFIG = {
  voice: 'en-US-JennyNeural', // Friendly female voice
  style: 'friendly', // Options: friendly, cheerful, empathetic, calm
  rate: 1.0, // 0.8-1.2 (slower for beginners, normal for advanced)
  pitch: 0, // -10 to +10
};

speechConfig.speechSynthesisVoiceName = VOICE_CONFIG.voice;
```

### Streaming Implementation

**Sentence-level streaming for low latency**:
```typescript
async function* synthesizeSpeechStreaming(text: string) {
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

  // Split into sentences for faster TTFB
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  for (const sentence of sentences) {
    const ssml = generateSSML(sentence, VOICE_CONFIG);

    // Create promise for synthesis
    const audioDataPromise = new Promise<Buffer[]>((resolve, reject) => {
      const audioChunks: Buffer[] = [];

      synthesizer.synthesizing = (s, e) => {
        if (e.result.audioData) {
          audioChunks.push(Buffer.from(e.result.audioData));
        }
      };

      synthesizer.synthesisCompleted = (s, e) => {
        resolve(audioChunks);
      };

      synthesizer.canceled = (s, e) => {
        reject(new Error(`TTS canceled: ${e.errorDetails}`));
      };

      synthesizer.speakSsmlAsync(ssml);
    });

    const chunks = await audioDataPromise;
    for (const chunk of chunks) {
      yield chunk;
    }
  }

  synthesizer.close();
}

function generateSSML(text: string, config: typeof VOICE_CONFIG): string {
  return `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"
           xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
      <voice name="${config.voice}">
        <mstts:express-as style="${config.style}">
          <prosody rate="${config.rate}" pitch="${config.pitch}%">
            ${escapeXml(text)}
          </prosody>
        </mstts:express-as>
      </voice>
    </speak>
  `;
}
```

### Advanced SSML Features

**1. Pronunciation Correction**:
```typescript
// If student struggles with a word, emphasize it in playback
function emphasizePronunciation(text: string, difficultWord: string): string {
  const emphasized = text.replace(
    difficultWord,
    `<emphasis level="strong">${difficultWord}</emphasis>`
  );

  return `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="en-US-JennyNeural">
        <prosody rate="0.8">
          ${emphasized}
        </prosody>
      </voice>
    </speak>
  `;
}
```

**2. Phoneme Control**:
```typescript
// Teach pronunciation with IPA
function teachPronunciation(word: string, ipa: string): string {
  return `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="en-US-JennyNeural">
        <prosody rate="0.7">
          The word is: <phoneme alphabet="ipa" ph="${ipa}">${word}</phoneme>
        </prosody>
        <break time="500ms"/>
        Listen again: <phoneme alphabet="ipa" ph="${ipa}">${word}</phoneme>
      </voice>
    </speak>
  `;
}
```

**3. Adaptive Speech Rate**:
```typescript
function getAdaptiveSpeechRate(userLevel: string): number {
  const rateMap = {
    'A1': 0.75, // Beginner: slower
    'A2': 0.85,
    'B1': 0.95,
    'B2': 1.0,  // Intermediate: normal
    'C1': 1.05,
    'C2': 1.1,  // Advanced: slightly faster
  };

  return rateMap[userLevel] || 1.0;
}
```

### Cost Optimization

**Pricing** (as of 2024):
- Neural voices: $16 per 1M characters
- Typical agent response: 100-200 characters
- 1000 responses: ~$1.60-3.20

**Optimization**:
1. **Caching common phrases**:
```typescript
const phraseCache = new Map<string, Buffer>();

async function synthesizeWithCache(text: string): Promise<Buffer> {
  if (phraseCache.has(text)) {
    return phraseCache.get(text)!;
  }

  const audio = await synthesizeSpeech(text);

  // Cache common encouragements, greetings
  if (isCommonPhrase(text)) {
    phraseCache.set(text, audio);
  }

  return audio;
}
```

2. **Batch synthesis for non-real-time**:
```typescript
// Pre-synthesize vocabulary pronunciation guides
async function batchSynthesize(words: string[]) {
  const batches = chunk(words, 50); // Process in batches

  for (const batch of batches) {
    await Promise.all(batch.map(word =>
      synthesizeAndStore(word, `pronunciation-${word}.mp3`)
    ));
  }
}
```

## Integration Architecture

### End-to-End Flow

```typescript
async function handleVoiceInteraction(audioStream: AsyncIterable<Buffer>, userId: string) {
  // 1. STT: Audio → Text
  const transcript = await new Promise<string>((resolve) => {
    streamAudioToDeepgram(
      audioStream,
      (result) => {
        if (result.isFinal) {
          resolve(result.text);
        }
      },
      (error) => console.error('Deepgram error:', error)
    );
  });

  // 2. Memory: Retrieve context
  const memory = await getFullMemoryContext(userId, transcript);

  // 3. LLM: Process with Llama
  const messages = buildMessages(memory, transcript);
  const tools = getAvailableTools();

  let response = '';
  let toolCalls = [];

  for await (const chunk of streamLlamaResponse(messages, tools)) {
    if (chunk.type === 'text') {
      response += chunk.content;

      // Start TTS as soon as we have a sentence
      if (response.match(/[.!?]$/)) {
        const sentence = response;
        response = '';

        // 4. TTS: Text → Audio (streaming)
        const audioStream = synthesizeSpeechStreaming(sentence);
        for await (const audioChunk of audioStream) {
          sendToClient(audioChunk); // Stream to user immediately
        }
      }
    }

    if (chunk.type === 'function_calls') {
      toolCalls = chunk.calls;
    }
  }

  // 5. Execute tools if needed
  if (toolCalls.length > 0) {
    const toolResults = await executeTools(toolCalls);

    // 6. Follow-up LLM call with tool results
    const followUpMessages = [...messages, {
      role: 'assistant',
      tool_calls: toolCalls
    }, {
      role: 'tool',
      content: JSON.stringify(toolResults)
    }];

    for await (const chunk of streamLlamaResponse(followUpMessages, [])) {
      if (chunk.type === 'text') {
        // Stream final response to TTS
        const audioStream = synthesizeSpeechStreaming(chunk.content);
        for await (const audioChunk of audioStream) {
          sendToClient(audioChunk);
        }
      }
    }
  }

  // 7. Store memory
  await storeMemory(userId, transcript, response, toolCalls.map(tc => tc.name));
}
```

### Performance Monitoring

```typescript
async function handleVoiceInteractionWithTelemetry(audioStream, userId) {
  const metrics = {
    stt_latency: 0,
    memory_latency: 0,
    llm_ttft: 0, // time to first token
    llm_total: 0,
    tool_execution: 0,
    tts_ttfb: 0, // time to first byte
    total: 0,
  };

  const start = Date.now();

  // ... (same implementation with timing)

  metrics.total = Date.now() - start;

  await logMetrics(userId, metrics);

  // Alert if latencies exceed targets
  if (metrics.total > 1000) { // Target: <800ms
    console.warn(`High latency detected: ${metrics.total}ms`, metrics);
  }
}
```

## Cost Analysis

### Per-User Per-Month Estimates

**Assumptions**:
- 20 sessions/month
- 10 minutes/session
- 20 agent responses/session

| Component | Usage | Cost/Month |
|-----------|-------|------------|
| Deepgram STT | 200 min | $0.86 |
| Llama 3.3-70B | ~400K tokens | $0.40 |
| Azure TTS | ~40K chars | $0.64 |
| **Total** | | **~$1.90/user/month** |

**Scaling to 1000 users**: ~$1,900/month in AI costs

**Optimization at scale**:
- Self-host Llama: Reduce to ~$0.10/user
- Phrase caching: Reduce TTS by 30%
- **Optimized cost**: ~$1.00/user/month

---

**Next**: See `06-USE-CASES.md` for real conversation scenarios.
