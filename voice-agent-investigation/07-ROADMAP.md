# Implementation Roadmap: From Voice Chat to Agentic Tutor

## Overview

This roadmap outlines a **phased approach** to building the agentic voice tutor, prioritizing:
1. **Quick wins** (demonstrate value fast)
2. **Incremental complexity** (each phase builds on the last)
3. **User feedback loops** (validate before scaling)
4. **Technical risk mitigation** (test critical components early)

## Phase 0: Foundation (Week 1-2)

### Goal
Set up core infrastructure and validate basic voice pipeline.

### Deliverables

#### 1. Database Schema
```sql
-- Core tables (extend existing Neon DB)

-- User profiles (semantic memory)
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  learner_name TEXT,
  native_language TEXT,
  target_language TEXT DEFAULT 'en',
  proficiency_level TEXT, -- A1-C2
  preferred_session_duration INTEGER DEFAULT 10,
  learning_style TEXT[],
  personality_traits JSONB,
  difficulty_level INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Episodic memory (vector storage)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE episodic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_message TEXT,
  agent_message TEXT,
  embedding vector(1536),
  topics TEXT[],
  detected_emotion TEXT,
  learning_activity TEXT,
  tools_used TEXT[]
);

CREATE INDEX idx_episodic_embedding ON episodic_memory
  USING ivfflat (embedding vector_cosine_ops);

-- Learning memory (vocabulary tracking)
CREATE TABLE user_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  word TEXT NOT NULL,
  mastery_level INTEGER DEFAULT 0,
  first_encountered TIMESTAMPTZ DEFAULT NOW(),
  last_practiced TIMESTAMPTZ,
  practice_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  next_review TIMESTAMPTZ,
  review_interval_days INTEGER DEFAULT 1,
  ease_factor NUMERIC DEFAULT 2.5,
  UNIQUE(user_id, word)
);

CREATE INDEX idx_vocab_next_review ON user_vocabulary(user_id, next_review);

-- Pronunciation tracking
CREATE TABLE pronunciation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  word TEXT,
  phoneme TEXT,
  quality TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  confidence_score NUMERIC,
  notes TEXT
);

-- Practice history
CREATE TABLE practice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  practice_date DATE DEFAULT CURRENT_DATE,
  total_minutes INTEGER DEFAULT 0,
  vocabulary_practiced INTEGER DEFAULT 0,
  vocabulary_mastered INTEGER DEFAULT 0,
  session_count INTEGER DEFAULT 0,
  UNIQUE(user_id, practice_date)
);
```

#### 2. Basic Voice Pipeline
```typescript
// Minimal working voice agent (no tools yet)

import { createClient as createDeepgramClient } from '@deepgram/sdk';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

// 1. STT
async function transcribeAudio(audioStream) {
  const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY);
  const connection = deepgram.listen.live({
    model: 'nova-3',
    language: 'en',
    smart_format: true,
    interim_results: false,
  });

  return new Promise((resolve) => {
    connection.on('Results', (data) => {
      if (data.is_final) {
        resolve(data.channel.alternatives[0].transcript);
      }
    });

    for await (const chunk of audioStream) {
      connection.send(chunk);
    }
  });
}

// 2. Simple LLM (no function calling yet)
async function getResponse(userMessage: string) {
  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      messages: [
        { role: 'system', content: 'You are a helpful language tutor.' },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

// 3. TTS
async function synthesizeSpeech(text: string): Promise<Buffer> {
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_SPEECH_REGION
  );
  speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';

  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

  return new Promise((resolve, reject) => {
    synthesizer.speakTextAsync(text,
      result => resolve(Buffer.from(result.audioData)),
      error => reject(error)
    );
  });
}
```

#### 3. WebRTC Setup
```typescript
// Use existing voice chat infrastructure
// Add:
// - Audio quality: 16kHz, mono, Opus codec
// - Low-latency WebRTC configuration
// - Echo cancellation enabled
```

### Success Metrics
- ✅ User speaks → hears response in <2 seconds
- ✅ STT accuracy >85% on test utterances
- ✅ TTS sounds natural (subjective test with 5 users)
- ✅ Database schema deployed to Neon

### Risks & Mitigation
- **Risk**: WebRTC latency issues
  - **Mitigation**: Test with users in different locations, fallback to STUN/TURN servers
- **Risk**: Deepgram API rate limits
  - **Mitigation**: Implement client-side VAD to reduce audio sent

---

## Phase 1: Basic Memory (Week 3-4)

### Goal
Give the agent basic memory so it feels personalized.

### Deliverables

#### 1. User Profile Creation
```typescript
// Onboarding flow
async function createUserProfile(userId: string, onboardingData: any) {
  await db.query(`
    INSERT INTO user_profiles (
      user_id, learner_name, native_language, target_language,
      proficiency_level, learning_style, difficulty_level
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    userId,
    onboardingData.name,
    onboardingData.nativeLanguage,
    onboardingData.targetLanguage || 'en',
    onboardingData.level || 'B1',
    onboardingData.learningStyle || [],
    5 // default difficulty
  ]);
}
```

#### 2. Simple Episodic Memory
```typescript
// Store conversations
async function storeConversationTurn(
  userId: string,
  userMessage: string,
  agentMessage: string
) {
  // Generate embedding
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: `${userMessage} ${agentMessage}`,
  });

  await db.query(`
    INSERT INTO episodic_memory (
      user_id, user_message, agent_message, embedding, timestamp
    ) VALUES ($1, $2, $3, $4, NOW())
  `, [userId, userMessage, agentMessage, embedding.data[0].embedding]);
}

// Retrieve relevant memories
async function getRelevantMemories(userId: string, currentMessage: string, limit = 3) {
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: currentMessage,
  });

  const results = await db.query(`
    SELECT user_message, agent_message, timestamp
    FROM episodic_memory
    WHERE user_id = $1
    ORDER BY embedding <=> $2::vector
    LIMIT $3
  `, [userId, embedding.data[0].embedding, limit]);

  return results.rows;
}
```

#### 3. Context-Aware Prompts
```typescript
// Build context from memory
async function buildContextualPrompt(userId: string, currentMessage: string) {
  const profile = await getUserProfile(userId);
  const memories = await getRelevantMemories(userId, currentMessage);

  return `
You are a language tutor for ${profile.learner_name}.
- Level: ${profile.proficiency_level}
- Native language: ${profile.native_language}

Recent relevant memories:
${memories.map(m => `- User said: "${m.user_message}"\n  You said: "${m.agent_message}"`).join('\n')}

Current message: "${currentMessage}"

Respond naturally, referencing past conversations when relevant.
`;
}
```

### Demo Scenario
```
User (Day 1): "Hi, I'm Maria. I want to improve my pronunciation."
Agent: "Hi Maria! Great to meet you. Let's start working on your pronunciation..."

[3 days later]

User: "Hi, I'm back!"
Agent: "Welcome back, Maria! Last time we worked on your pronunciation.
       Want to continue with that, or try something different today?"
```

### Success Metrics
- ✅ Agent remembers user's name across sessions
- ✅ Agent references past topics in >50% of multi-session users
- ✅ User survey: "Agent feels personalized" >70% agreement

---

## Phase 2: First Tools (Week 5-6)

### Goal
Enable agent to take actions beyond conversation.

### Deliverables

#### 1. Core Educational Tools
```typescript
const TOOLS_V1 = [
  {
    name: "query_user_vocabulary",
    description: "Check which words the user knows",
    // ... (see 04-TOOLS.md)
  },
  {
    name: "track_vocabulary_practice",
    description: "Log vocabulary practice for progress tracking",
  },
  {
    name: "get_learning_stats",
    description: "Get user's learning statistics",
  },
];
```

#### 2. Function Calling Integration
```typescript
async function processWithTools(userId: string, userMessage: string) {
  const context = await buildContextualPrompt(userId, userMessage);

  // LLM call with tools
  const response = await together.chat.completions.create({
    model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    messages: [{ role: "user", content: context }],
    tools: TOOLS_V1,
    tool_choice: "auto",
  });

  // Execute tools if called
  if (response.choices[0].message.tool_calls) {
    const toolResults = await executeTools(
      response.choices[0].message.tool_calls
    );

    // Follow-up LLM call with results
    const finalResponse = await together.chat.completions.create({
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      messages: [
        { role: "user", content: context },
        response.choices[0].message,
        { role: "tool", content: JSON.stringify(toolResults) },
      ],
    });

    return finalResponse.choices[0].message.content;
  }

  return response.choices[0].message.content;
}
```

#### 3. Tool Execution Layer
```typescript
async function executeTools(toolCalls: ToolCall[]) {
  const results = await Promise.all(toolCalls.map(async (call) => {
    switch (call.function.name) {
      case 'query_user_vocabulary':
        return await queryUserVocabulary(
          call.function.arguments.user_id,
          call.function.arguments.words
        );

      case 'track_vocabulary_practice':
        return await trackVocabularyPractice(
          call.function.arguments.user_id,
          call.function.arguments.word,
          call.function.arguments.quality
        );

      case 'get_learning_stats':
        return await getLearningStats(
          call.function.arguments.user_id,
          call.function.arguments.timeframe
        );
    }
  }));

  return results;
}
```

### Demo Scenario
```
User: "How am I doing this week?"
Agent: [Calls get_learning_stats(timeframe: "week")]
Agent: "You've practiced 45 minutes this week and learned 12 new words.
       That's 50% more than last week! You're on fire!"
```

### Success Metrics
- ✅ Tools called successfully in >90% of attempts
- ✅ Tool execution <200ms average
- ✅ Agent provides data-driven insights (not just guessing)

---

## Phase 3: Spaced Repetition (Week 7-8)

### Goal
Implement research-backed spaced repetition system.

### Deliverables

#### 1. Spaced Repetition Tools
```typescript
{
  name: "schedule_spaced_review",
  description: "Schedule vocabulary review using research-backed intervals (7, 14, 28 days)",
  // ... implementation in 04-TOOLS.md
}
```

#### 2. Review Scheduling Logic
```typescript
// SM-2 algorithm implementation (see 03-MEMORY.md)
async function scheduleNextReview(userId, word, performance) {
  // ... (see detailed implementation)
}
```

#### 3. Proactive Review Reminders
```typescript
async function checkDueReviews(userId: string) {
  const dueReviews = await db.query(`
    SELECT word, mastery_level
    FROM user_vocabulary
    WHERE user_id = $1
      AND next_review <= NOW()
    ORDER BY next_review
    LIMIT 10
  `, [userId]);

  if (dueReviews.rows.length > 0) {
    return {
      hasDueReviews: true,
      count: dueReviews.rows.length,
      words: dueReviews.rows,
    };
  }

  return { hasDueReviews: false };
}

// Agent proactively suggests reviews
async function sessionStart(userId: string) {
  const reviews = await checkDueReviews(userId);

  if (reviews.hasDueReviews) {
    return `Hi! You have ${reviews.count} words ready for review today. Want to start with those?`;
  }

  return "Hi! What would you like to work on today?";
}
```

### Demo Scenario
```
[User learns "collaborate", "achieve", "develop" on Day 1]
[Agent schedules review for Day 8 (7-day interval)]

Day 8:
Agent: "Welcome back! You have 3 words ready for review: collaborate,
       achieve, and develop. Let's quickly go through them!"

[User reviews successfully]

Agent: [Schedules next review for Day 22 (14-day interval)]
```

### Success Metrics
- ✅ Users complete >70% of scheduled reviews
- ✅ Vocabulary retention rate >85% at 28-day review
- ✅ Spaced repetition scheduling matches research (7→14→28→56 pattern)

---

## Phase 4: Pronunciation & Fluency (Week 9-10)

### Goal
Add pronunciation assessment and 4-3-2 fluency tracking.

### Deliverables

#### 1. Pronunciation Analysis
```typescript
// Use Deepgram word-level confidence + phonetic analysis
async function assessPronunciation(targetWord, deepgramWords) {
  // ... (see 04-TOOLS.md)
}

{
  name: "assess_pronunciation",
  description: "Analyze pronunciation quality and provide feedback",
}

{
  name: "track_pronunciation_attempt",
  description: "Log pronunciation practice",
}
```

#### 2. 4-3-2 Fluency Sessions
```typescript
async function conduct_4_3_2_session(userId: string, topic: string) {
  const results = {
    round1: { duration: 240, wpm: 0, fillerWords: 0 },
    round2: { duration: 180, wpm: 0, fillerWords: 0 },
    round3: { duration: 120, wpm: 0, fillerWords: 0 },
  };

  for (const round of ['round1', 'round2', 'round3']) {
    const transcript = await recordAndTranscribe(results[round].duration);

    results[round].wpm = calculateWPM(transcript, results[round].duration);
    results[round].fillerWords = countFillerWords(transcript);
  }

  const improvement = ((results.round3.wpm - results.round1.wpm) / results.round1.wpm) * 100;

  await db.query(`
    INSERT INTO fluency_sessions (
      user_id, topic,
      round_1_wpm, round_2_wpm, round_3_wpm,
      wpm_improvement_percent
    ) VALUES ($1, $2, $3, $4, $5, $6)
  `, [userId, topic, results.round1.wpm, results.round2.wpm, results.round3.wpm, improvement]);

  return {
    ...results,
    improvement: Math.round(improvement),
  };
}
```

### Demo Scenario
```
Agent: "Let's do a 4-3-2 fluency session! Your topic: Describe your favorite place.
       You'll speak for 4 minutes, then 3 minutes, then 2 minutes—same topic each time.
       Ready for Round 1?"

[After Round 3]

Agent: "Amazing! You went from 78 WPM in Round 1 to 112 WPM in Round 3.
       That's a 44% improvement! And you cut your 'um's and 'uh's by 70%.
       Your fluency is really developing!"
```

### Success Metrics
- ✅ Average WPM improvement >30% from Round 1 to Round 3
- ✅ Pronunciation feedback accuracy >80% (manual validation)
- ✅ Users complete full 4-3-2 sessions >60% attempt rate

---

## Phase 5: Adaptive Intelligence (Week 11-12)

### Goal
Make agent adaptive: detect struggles, adjust difficulty, provide emotional support.

### Deliverables

#### 1. Emotion Detection
```typescript
function detectEmotion(userMessage: string, deepgramData: any) {
  // Heuristics (simple v1):
  const frustrationKeywords = ['i cant', 'this is hard', 'i dont understand', 'frustrated'];
  const excitementKeywords = ['yes!', 'i did it', 'awesome', 'great'];

  const lowerMessage = userMessage.toLowerCase();

  if (frustrationKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'frustrated';
  }

  if (excitementKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'excited';
  }

  // Use filler word count as proxy for confidence
  if (deepgramData.fillerWordCount > 5) {
    return 'uncertain';
  }

  return 'neutral';
}
```

#### 2. Difficulty Adjustment
```typescript
{
  name: "adjust_difficulty",
  description: "Adjust difficulty when user is struggling or bored",
  // ... (see 04-TOOLS.md)
}

// Auto-adjustment logic
async function checkForAutoAdjustment(userId: string) {
  const recentAttempts = await db.query(`
    SELECT quality, COUNT(*) as count
    FROM pronunciation_log
    WHERE user_id = $1
      AND timestamp > NOW() - INTERVAL '10 minutes'
    GROUP BY quality
  `, [userId]);

  const struggles = recentAttempts.rows.find(r => r.quality === 'poor')?.count || 0;

  if (struggles >= 3) {
    // Auto-adjust easier
    await adjust_difficulty(userId, 'easier', 'User struggled with 3+ items in 10 minutes');
    return { adjusted: true, direction: 'easier' };
  }

  return { adjusted: false };
}
```

#### 3. Encouragement System
```typescript
{
  name: "celebrate_milestone",
  description: "Celebrate achievements to maintain motivation",
}

// Milestone detection
async function detectMilestones(userId: string) {
  const milestones = [];

  // Check streak
  const streak = await getCurrentStreak(userId);
  if (streak === 7 || streak === 14 || streak === 30) {
    milestones.push({ type: 'streak', value: streak });
  }

  // Check vocabulary
  const vocabCount = await getMasteredVocabularyCount(userId);
  if (vocabCount % 50 === 0) {
    milestones.push({ type: 'vocabulary_milestone', value: vocabCount });
  }

  return milestones;
}
```

### Demo Scenario
```
[User struggles 3 times in a row]

Agent Internal: [Detects frustration, adjusts difficulty easier]
Agent: "Hey, I noticed you're working really hard on these. Let's take it down
       a notch—there's no rush. How about we practice with some words you already
       know well to build confidence?"

[User masters 50th word]

Agent: [Calls celebrate_milestone]
Agent: "🎉 You just mastered your 50th word! That's a huge milestone!
       You're building a real vocabulary foundation. Awesome work!"
```

### Success Metrics
- ✅ Frustration detected and handled >80% of occurrences
- ✅ Difficulty auto-adjusts appropriately >75% of cases
- ✅ User retention increases 20% (vs. non-adaptive baseline)

---

## Phase 6: Polish & Scale (Week 13-14)

### Goal
Production-ready system with monitoring, optimization, and scaling.

### Deliverables

#### 1. Performance Monitoring
```typescript
// Latency tracking
async function trackLatency(userId, phase, duration) {
  await db.query(`
    INSERT INTO latency_logs (user_id, phase, duration_ms, timestamp)
    VALUES ($1, $2, $3, NOW())
  `, [userId, phase, duration]);
}

// Alert on high latency
if (totalLatency > 1000) {
  await alertDevTeam(`High latency: ${totalLatency}ms for user ${userId}`);
}
```

#### 2. Cost Optimization
- Implement caching for common phrases (TTS)
- Client-side VAD to reduce Deepgram costs
- Prompt caching for LLM (if provider supports)
- Monitor token usage per user

#### 3. User Analytics Dashboard
```sql
-- Key metrics query
SELECT
  DATE_TRUNC('day', timestamp) as date,
  COUNT(DISTINCT user_id) as active_users,
  AVG(total_latency_ms) as avg_latency,
  SUM(tool_calls) as total_tool_calls,
  AVG(session_duration_seconds) as avg_session_duration
FROM session_logs
GROUP BY DATE_TRUNC('day', timestamp)
ORDER BY date DESC;
```

#### 4. A/B Testing Framework
```typescript
// Test different pedagogical approaches
async function getAgentVariant(userId: string) {
  const variant = await db.query(`
    SELECT variant FROM user_experiments
    WHERE user_id = $1 AND experiment = 'encouragement_frequency'
  `, [userId]);

  return variant.rows[0]?.variant || 'control';
}

// Variant A: High encouragement
// Variant B: Moderate encouragement
// Variant C: Minimal encouragement

// Track outcomes
await trackExperimentMetric(userId, 'retention_7_day', retentionRate);
```

### Success Metrics
- ✅ P95 latency <1 second
- ✅ Monthly cost <$2/user
- ✅ >95% uptime
- ✅ User NPS >50

---

## Timeline Summary

| Phase | Weeks | Key Deliverable | Risk Level |
|-------|-------|----------------|------------|
| Phase 0 | 1-2 | Basic voice pipeline | Low |
| Phase 1 | 3-4 | Memory system | Medium |
| Phase 2 | 5-6 | Function calling & tools | High |
| Phase 3 | 7-8 | Spaced repetition | Low |
| Phase 4 | 9-10 | Pronunciation & fluency | Medium |
| Phase 5 | 11-12 | Adaptive intelligence | High |
| Phase 6 | 13-14 | Production polish | Low |

**Total: 14 weeks (~3.5 months) to production**

---

## Resource Requirements

### Team
- **1 Backend Engineer**: Database, API, tool execution
- **1 ML Engineer**: LLM integration, prompt engineering, memory systems
- **1 Frontend Engineer**: Voice UI, WebRTC, real-time audio
- **0.5 Product Manager**: User research, metrics, prioritization
- **0.25 Designer**: Voice interaction design, conversation flows

### Infrastructure
- **Neon DB**: Existing (add pgvector extension)
- **Deepgram**: Pay-as-you-go (~$0.86/user/month)
- **Llama 3.3-70B**: Together.ai or similar (~$0.40/user/month)
- **Azure TTS**: Pay-as-you-go (~$0.64/user/month)
- **Application Server**: 2x EC2 t3.medium or equivalent (~$60/month)
- **Redis**: For session state (~$20/month)

**Total infrastructure cost at 100 users**: ~$200-250/month

---

## Go/No-Go Decision Points

### After Phase 1 (Week 4)
**Question**: Does memory make conversations feel personalized?
- **Go criteria**: >70% users say "agent remembers me"
- **No-go**: Memory feels creepy or irrelevant

### After Phase 2 (Week 6)
**Question**: Do tools enable genuinely useful actions?
- **Go criteria**: >80% tool call success rate, users find stats helpful
- **No-go**: Tools fail frequently or feel gimmicky

### After Phase 4 (Week 10)
**Question**: Are educational features driving real learning outcomes?
- **Go criteria**: Measurable improvement in vocabulary retention or fluency
- **No-go**: No improvement vs. non-agentic baseline

---

## Success Definition

The agentic voice tutor is successful when:

1. **Users say**: "It really knows me" (>80% agreement)
2. **Data shows**: 30% improvement in vocabulary retention vs. baseline
3. **Behavior shows**: 50% higher retention rate (30-day) vs. non-agentic chat
4. **Technical shows**: <800ms end-to-end latency, >98% tool reliability
5. **Business shows**: Path to <$1.50/user/month all-in cost at scale

---

## Next Steps

1. **Review this investigation** with team
2. **Validate assumptions** with 5 user interviews
3. **Spike on highest-risk items**:
   - Llama 3.3-70B function calling reliability
   - WebRTC latency in production environment
   - Vector search performance at scale
4. **Commit to Phase 0** if spike results are positive
5. **Set up metrics dashboard** before starting Phase 1

---

## Open Questions

1. **Voice cloning**: Should we offer custom voices for users who want consistency?
2. **Multimodal**: Add video (for pronunciation demos) or stay voice-only?
3. **Languages**: English-only MVP, or support Spanish/French from day 1?
4. **Freemium model**: How many free sessions before paywall?
5. **Mobile-first**: PWA or native app for better audio quality?

**Recommendation**: Answer questions 3-5 before Phase 0, defer 1-2 to post-Phase 6.
