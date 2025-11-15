# Voice Agent Architecture: Deep Technical Design

## System Architecture

### High-Level Flow

```
┌──────────────┐
│   Browser    │
│  (WebRTC)    │
└──────┬───────┘
       │ Audio stream (Opus codec)
       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Voice Agent Server                         │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Input Processing Pipeline                 │  │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────────┐    │  │
│  │  │ WebRTC   │───▶│ Deepgram │───▶│ VAD + Turn   │    │  │
│  │  │ Receiver │    │ STT      │    │ Detection    │    │  │
│  │  └──────────┘    └──────────┘    └──────────────┘    │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                    │
│                          ▼ Transcript                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Agentic Processing Core                   │  │
│  │                                                         │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 1. Memory Retrieval                              │  │  │
│  │  │    - Fetch relevant episodic memories            │  │  │
│  │  │    - Load user profile (semantic memory)         │  │  │
│  │  │    - Retrieve learning history                   │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          │                              │  │
│  │                          ▼                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 2. Context Assembly                              │  │  │
│  │  │    - System prompt (pedagogical role)            │  │  │
│  │  │    - User profile context                        │  │  │
│  │  │    - Conversation history (last N turns)         │  │  │
│  │  │    - Retrieved memories                          │  │  │
│  │  │    - Available tools                             │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          │                              │  │
│  │                          ▼                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 3. LLM Processing (Llama 3.3-70B)               │  │  │
│  │  │    - Reasoning about user's needs                │  │  │
│  │  │    - Deciding on tool calls                      │  │  │
│  │  │    - Generating response                         │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          │                              │  │
│  │                          ▼                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 4. Tool Execution (parallel)                     │  │  │
│  │  │    - Database queries                            │  │  │
│  │  │    - Computation                                 │  │  │
│  │  │    - Content generation                          │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          │                              │  │
│  │                          ▼                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 5. Response Synthesis                            │  │  │
│  │  │    - Incorporate tool results                    │  │  │
│  │  │    - Final LLM call (if needed)                  │  │  │
│  │  │    - Format for TTS                              │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  │                          │                              │  │
│  │                          ▼                              │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │ 6. Memory Storage                                │  │  │
│  │  │    - Save conversation turn                      │  │  │
│  │  │    - Update user profile                         │  │  │
│  │  │    - Log learning events                         │  │  │
│  │  │    - Update vector embeddings                    │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │                                    │
│                          ▼ Text response                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Output Processing Pipeline                │  │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────────┐    │  │
│  │  │ Azure    │───▶│ Audio    │───▶│ WebRTC       │    │  │
│  │  │ TTS      │    │ Buffer   │    │ Sender       │    │  │
│  │  └──────────┘    └──────────┘    └──────────────┘    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│   Browser    │
│  (Speaker)   │
└──────────────┘
```

## Component Breakdown

### 1. Audio Input Pipeline

#### WebRTC Connection
```typescript
interface AudioConfig {
  codec: 'opus';           // Low latency, good for voice
  sampleRate: 16000;       // Optimal for speech recognition
  channels: 1;             // Mono
  bitrate: 24000;          // Balance quality/bandwidth
}
```

**Why WebRTC?**
- Sub-150ms latency (often <50ms)
- Built-in echo cancellation
- Adaptive bitrate
- NAT traversal
- Direct peer-to-peer when possible

**Implementation Consideration**: Use LiveKit or Janus as WebRTC orchestration layer

#### Deepgram STT Integration

**Model Selection**: Nova-3
- 50% lower WER than competitors
- <300ms latency
- Streaming with interim results
- Multi-language support

```typescript
interface DeepgramConfig {
  model: 'nova-3';
  language: 'en' | 'es' | 'fr' | ...;  // User's native language
  smart_format: true;                   // Format numbers, emails, etc.
  interim_results: true;                // Get partial transcripts
  endpointing: 200;                     // ms of silence = end of utterance
  punctuate: true;
  diarize: false;                       // Single speaker
  filler_words: true;                   // Track "um", "uh" for fluency analysis
}
```

**Streaming Architecture**:
```typescript
async function* processAudioStream(audioStream: AsyncIterable<Buffer>) {
  const deepgramConnection = await deepgram.listen.live({
    model: 'nova-3',
    language: currentUserLanguage,
    smart_format: true,
    interim_results: true,
    endpointing: 200,
  });

  for await (const audioChunk of audioStream) {
    deepgramConnection.send(audioChunk);
  }

  // Listen for results
  for await (const result of deepgramConnection) {
    if (result.is_final) {
      yield {
        transcript: result.channel.alternatives[0].transcript,
        confidence: result.channel.alternatives[0].confidence,
        words: result.channel.alternatives[0].words, // For pronunciation analysis
      };
    }
  }
}
```

#### Voice Activity Detection (VAD) + Turn Detection

**Purpose**: Know when user is done speaking vs. just pausing

**Strategy**:
1. Use Deepgram's built-in endpointing (primary)
2. Backup: Silero VAD model for client-side pre-filtering
3. Adaptive silence threshold based on user's speech patterns

```typescript
interface TurnDetectionConfig {
  silenceThreshold: number;      // ms of silence = end of turn
  minUtteranceLength: number;    // Ignore very short sounds
  adaptiveThreshold: boolean;    // Learn user's pause patterns
}

// Example: User who speaks slowly gets longer threshold
function calculateSilenceThreshold(userProfile: UserProfile): number {
  const baseThreshold = 200; // ms
  const userPauseAverage = userProfile.averagePauseDuration;
  return baseThreshold + (userPauseAverage * 0.5);
}
```

### 2. Agentic Processing Core

This is the heart of the system. Let's break down each step.

#### Step 1: Memory Retrieval

**Goal**: Fetch relevant context from user's history

**Three Memory Systems** (detailed in 03-MEMORY.md):
1. **Episodic**: Specific past interactions
2. **Semantic**: General facts about user
3. **Learning**: Educational progress data

```typescript
async function retrieveMemory(userId: string, currentUtterance: string) {
  // Parallel retrieval for speed
  const [episodic, semantic, learning] = await Promise.all([
    retrieveEpisodicMemory(userId, currentUtterance),
    retrieveSemanticMemory(userId),
    retrieveLearningMemory(userId),
  ]);

  return { episodic, semantic, learning };
}
```

**Episodic Memory Retrieval** (Vector Search):
```sql
-- Using pgvector for similarity search
SELECT
  conversation_id,
  timestamp,
  user_message,
  agent_message,
  emotional_state,
  topics,
  1 - (embedding <=> $1) as similarity
FROM episodic_memory
WHERE user_id = $2
ORDER BY similarity DESC
LIMIT 5;
```

**Semantic Memory Retrieval** (Direct Query):
```sql
-- Structured user profile
SELECT
  learning_preferences,
  proficiency_level,
  known_vocabulary_count,
  common_mistakes,
  personality_traits,
  session_preferences
FROM user_profiles
WHERE user_id = $1;
```

**Learning Memory Retrieval** (Educational Data):
```sql
-- Get recent learning activity
SELECT
  vocabulary_mastered_last_7_days,
  current_difficulty_level,
  upcoming_reviews,
  pronunciation_struggles,
  fluency_metrics
FROM learning_progress
WHERE user_id = $1;
```

#### Step 2: Context Assembly

**Goal**: Build the perfect prompt for the LLM

```typescript
function assembleContext(
  userUtterance: string,
  memory: Memory,
  conversationHistory: Message[],
): string {
  return `
# ROLE
You are ${memory.semantic.preferredTutorName || 'Alex'}, a personalized AI language tutor for ${memory.semantic.learnerName}. You are warm, encouraging, and pedagogically sophisticated.

# STUDENT PROFILE
- Name: ${memory.semantic.learnerName}
- Level: ${memory.semantic.proficiencyLevel}
- Native Language: ${memory.semantic.nativeLanguage}
- Learning Goals: ${memory.semantic.goals.join(', ')}
- Session Preference: ${memory.semantic.sessionPreference} (e.g., "short and frequent")
- Learning Style: ${memory.semantic.learningStyle} (e.g., "visual, needs examples")

# CURRENT LEARNING STATE
- Vocabulary Known: ${memory.learning.knownVocabularyCount} words
- Current Focus: ${memory.learning.currentFocus}
- Recent Struggles: ${memory.learning.recentStruggles.join(', ')}
- Upcoming Review: ${memory.learning.upcomingReviews[0]?.topic || 'None scheduled'}

# RECENT RELEVANT MEMORIES
${memory.episodic.map(ep => `
- ${formatTimestamp(ep.timestamp)}: User struggled with "${ep.topic}". ${ep.emotionalState === 'frustrated' ? 'They seemed frustrated.' : ''}
`).join('\n')}

# CONVERSATION HISTORY (Last 5 turns)
${conversationHistory.slice(-5).map(msg => `
${msg.role}: ${msg.content}
`).join('\n')}

# AVAILABLE TOOLS
You can use these tools to help the student:
${JSON.stringify(availableTools, null, 2)}

# CURRENT SITUATION
User just said: "${userUtterance}"

# YOUR TASK
Respond naturally and helpfully. Use tools when they would genuinely help the student's learning. Be encouraging but honest. Remember their history and preferences.
`;
}
```

#### Step 3: LLM Processing (Llama 3.3-70B)

**Why Llama 3.3-70B?**
- Strong function calling capabilities
- Good reasoning ability
- Cost-effective for high-volume usage
- Fast inference (especially quantized versions)
- Can run on-prem or cloud

**Function Calling Setup**:
```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "query_user_vocabulary",
      description: "Check which words/phrases the user already knows",
      parameters: {
        type: "object",
        properties: {
          words: {
            type: "array",
            items: { type: "string" },
            description: "Words to check"
          }
        },
        required: ["words"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_spaced_review",
      description: "Schedule a vocabulary/phrase review using spaced repetition",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string" },
            description: "Items to review"
          },
          interval_days: {
            type: "number",
            description: "Days until review (use research-backed intervals: 7, 14, 28)"
          }
        },
        required: ["items", "interval_days"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_practice_sentence",
      description: "Generate a sentence for practice using user's vocabulary level",
      parameters: {
        type: "object",
        properties: {
          target_words: {
            type: "array",
            items: { type: "string" },
            description: "Words to include"
          },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
            description: "Sentence difficulty"
          }
        },
        required: ["target_words"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "track_pronunciation_attempt",
      description: "Log a pronunciation attempt for progress tracking",
      parameters: {
        type: "object",
        properties: {
          word: { type: "string" },
          quality: {
            type: "string",
            enum: ["poor", "fair", "good", "excellent"]
          },
          notes: { type: "string" }
        },
        required: ["word", "quality"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "adjust_difficulty",
      description: "Adjust the learning difficulty level",
      parameters: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["easier", "harder"],
            description: "Direction to adjust"
          },
          reason: { type: "string" }
        },
        required: ["direction", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_learning_stats",
      description: "Get detailed learning statistics and progress",
      parameters: {
        type: "object",
        properties: {
          timeframe: {
            type: "string",
            enum: ["today", "week", "month", "all_time"],
            description: "Timeframe for stats"
          }
        },
        required: ["timeframe"]
      }
    }
  }
];

async function processWithLLM(context: string, tools: Tool[]) {
  const response = await llamaClient.chat.completions.create({
    model: "llama-3.3-70b-instruct",
    messages: [{ role: "user", content: context }],
    tools: tools,
    tool_choice: "auto", // Let model decide when to use tools
    temperature: 0.7,    // Balance creativity and consistency
    max_tokens: 1000,    // Reasonable for conversational responses
  });

  return response;
}
```

#### Step 4: Tool Execution

**Key Principle**: Execute tools in parallel when possible

```typescript
async function executeTools(toolCalls: ToolCall[]) {
  // Group into parallel and sequential
  const parallelCalls = toolCalls.filter(call => !call.dependsOnOthers);
  const sequentialCalls = toolCalls.filter(call => call.dependsOnOthers);

  // Execute parallel calls simultaneously
  const parallelResults = await Promise.all(
    parallelCalls.map(call => executeTool(call))
  );

  // Execute sequential calls in order
  const sequentialResults = [];
  for (const call of sequentialCalls) {
    const result = await executeTool(call, sequentialResults);
    sequentialResults.push(result);
  }

  return [...parallelResults, ...sequentialResults];
}

async function executeTool(toolCall: ToolCall, previousResults?: any[]) {
  const { name, arguments: args } = toolCall;

  switch (name) {
    case 'query_user_vocabulary':
      return await db.query(`
        SELECT word, mastery_level, last_practiced
        FROM user_vocabulary
        WHERE user_id = $1 AND word = ANY($2)
      `, [userId, args.words]);

    case 'schedule_spaced_review':
      return await db.query(`
        INSERT INTO spaced_reviews (user_id, items, scheduled_date)
        VALUES ($1, $2, NOW() + INTERVAL '${args.interval_days} days')
        RETURNING id, scheduled_date
      `, [userId, args.items]);

    case 'generate_practice_sentence':
      // Use a secondary LLM call or template system
      return await generateSentence(args.target_words, args.difficulty);

    case 'track_pronunciation_attempt':
      return await db.query(`
        INSERT INTO pronunciation_log (user_id, word, quality, timestamp, notes)
        VALUES ($1, $2, $3, NOW(), $4)
      `, [userId, args.word, args.quality, args.notes]);

    case 'adjust_difficulty':
      return await db.query(`
        UPDATE user_profiles
        SET difficulty_level = difficulty_level ${args.direction === 'harder' ? '+' : '-'} 1,
            last_adjustment = NOW(),
            adjustment_reason = $2
        WHERE user_id = $1
        RETURNING difficulty_level
      `, [userId, args.reason]);

    case 'get_learning_stats':
      return await getLearningStats(userId, args.timeframe);
  }
}
```

#### Step 5: Response Synthesis

**Goal**: Combine tool results with conversational response

```typescript
async function synthesizeResponse(
  initialResponse: string,
  toolResults: ToolResult[],
) {
  // If LLM already generated final response, use it
  if (initialResponse && !toolResults.length) {
    return initialResponse;
  }

  // If tools were called, do a follow-up LLM call with results
  const contextWithResults = `
${previousContext}

# TOOL RESULTS
${toolResults.map(result => `
${result.toolName}:
${JSON.stringify(result.data, null, 2)}
`).join('\n')}

# TASK
Based on these tool results, provide a natural, conversational response to the user. Incorporate the information smoothly without being mechanical.
`;

  const finalResponse = await llamaClient.chat.completions.create({
    model: "llama-3.3-70b-instruct",
    messages: [{ role: "user", content: contextWithResults }],
    temperature: 0.8,
    max_tokens: 500,
  });

  return finalResponse.choices[0].message.content;
}
```

#### Step 6: Memory Storage

**Goal**: Save this interaction for future context

```typescript
async function storeMemory(
  userId: string,
  userMessage: string,
  agentResponse: string,
  toolsUsed: string[],
  detectedEmotion: string,
) {
  // 1. Store episodic memory (conversation turn)
  const embedding = await generateEmbedding(userMessage + ' ' + agentResponse);

  await db.query(`
    INSERT INTO episodic_memory (
      user_id,
      timestamp,
      user_message,
      agent_message,
      embedding,
      tools_used,
      detected_emotion,
      topics
    ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)
  `, [userId, userMessage, agentResponse, embedding, toolsUsed, detectedEmotion, extractTopics(userMessage)]);

  // 2. Update semantic memory (user profile) if needed
  if (detectedEmotion === 'frustrated') {
    await db.query(`
      UPDATE user_profiles
      SET frustration_count = frustration_count + 1,
          last_frustration = NOW()
      WHERE user_id = $1
    `, [userId]);
  }

  // 3. Update learning memory (progress tracking)
  const wordsUsed = extractWords(userMessage);
  await db.query(`
    UPDATE user_vocabulary
    SET usage_count = usage_count + 1,
        last_used = NOW()
    WHERE user_id = $1 AND word = ANY($2)
  `, [userId, wordsUsed]);
}
```

### 3. Audio Output Pipeline

#### Azure TTS Integration

**Voice Selection**: Neural voices for naturalness
- Multiple language support
- Emotion/style controls (friendly, encouraging, etc.)
- SSML support for precise control

```typescript
interface TTSConfig {
  voice: 'en-US-JennyNeural' | 'en-US-GuyNeural' | ...;
  style: 'friendly' | 'encouraging' | 'excited' | 'calm';
  rate: number;  // 0.8 - 1.2 (adjust for learner comprehension)
  pitch: number; // -10 to +10
}

async function* synthesizeSpeech(text: string, config: TTSConfig) {
  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">
      <voice name="${config.voice}">
        <mstts:express-as style="${config.style}">
          <prosody rate="${config.rate}" pitch="${config.pitch}%">
            ${text}
          </prosody>
        </mstts:express-as>
      </voice>
    </speak>
  `;

  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

  // Stream audio as it's generated
  synthesizer.synthesizing = (s, e) => {
    yield e.result.audioData; // Stream chunks immediately
  };

  await synthesizer.speakSsmlAsync(ssml);
}
```

**Latency Optimization**:
1. **Sentence-level streaming**: Start TTS as soon as LLM outputs a sentence
2. **Compressed format**: Use Opus for network efficiency
3. **Pre-buffering**: Start playback after 100ms of audio received

```typescript
async function streamTTSToWebRTC(text: string, webrtcConnection: RTCPeerConnection) {
  // Split text by sentences for faster TTFB (time to first byte)
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  for (const sentence of sentences) {
    const audioStream = synthesizeSpeech(sentence, ttsConfig);

    for await (const audioChunk of audioStream) {
      webrtcConnection.send(audioChunk);
    }
  }
}
```

## Latency Budget

| Component | Target | Notes |
|-----------|--------|-------|
| Audio capture | <20ms | WebRTC native |
| Network (client→server) | <50ms | Depends on user's connection |
| Deepgram STT | <300ms | Streaming, Nova-3 model |
| Memory retrieval | <100ms | Parallel queries, indexed DB |
| LLM inference (first token) | <200ms | Optimized Llama 3.3-70B |
| Tool execution | <150ms | Parallel, indexed queries |
| LLM final response | <300ms | Streaming |
| Azure TTS (first byte) | <100ms | Streaming synthesis |
| Network (server→client) | <50ms | WebRTC |
| Audio playback | <20ms | Native |
| **Total** | **<800ms** | End-to-end target |

## Scaling Considerations

### Horizontal Scaling
- Stateless agent servers behind load balancer
- Shared database (Neon scales automatically)
- Redis for session state

### Vertical Scaling
- GPU for LLM inference (or use hosted API)
- Optimized quantized models (4-bit or 8-bit)
- Caching frequent tool results

### Cost Optimization
- Use smaller models for simple interactions (Llama 3.1-8B for chitchat)
- Cache embeddings for common phrases
- Batch database queries
- Use Deepgram's pay-per-use model efficiently

---

**Next**: See `03-MEMORY.md` for deep dive into memory systems.
