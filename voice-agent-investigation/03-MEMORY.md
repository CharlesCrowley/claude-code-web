# Memory Systems: Making Users Feel Known

## The Memory Challenge

**The Goal**: When a user says "I want to work on my pronunciation," the agent should think:
- "Last Tuesday, Sarah struggled with 'th' sounds in 'thorough' and 'thought'"
- "She prefers 10-minute sessions because she practices during lunch breaks"
- "She's at intermediate level (B1), knows ~2,400 words"
- "She gets frustrated easily but responds well to encouragement"
- "She has a Spanish accent, which explains the 'th' difficulty"

This requires THREE types of memory working together.

## Three-Part Memory Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   MEMORY SYSTEMS                         │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  EPISODIC MEMORY                               │    │
│  │  "What happened"                               │    │
│  │  ─────────────────────────────────────────     │    │
│  │  • Past conversations                          │    │
│  │  • Specific struggles/successes                │    │
│  │  • Emotional moments                           │    │
│  │  • Learning breakthroughs                      │    │
│  │                                                 │    │
│  │  Storage: Vector DB (pgvector) for similarity  │    │
│  │  Retrieval: Semantic search on current context │    │
│  └────────────────────────────────────────────────┘    │
│                        ▲                                 │
│                        │ Contextualizes                  │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────┐    │
│  │  SEMANTIC MEMORY                               │    │
│  │  "What is true"                                │    │
│  │  ─────────────────────────────────────────     │    │
│  │  • User profile & preferences                  │    │
│  │  • Learning style                              │    │
│  │  • Personality traits                          │    │
│  │  • Goals & motivations                         │    │
│  │                                                 │    │
│  │  Storage: Structured PostgreSQL tables         │    │
│  │  Retrieval: Direct query by user_id            │    │
│  └────────────────────────────────────────────────┘    │
│                        ▲                                 │
│                        │ Informs                         │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────┐    │
│  │  LEARNING MEMORY                               │    │
│  │  "What they know"                              │    │
│  │  ─────────────────────────────────────────     │    │
│  │  • Vocabulary mastery                          │    │
│  │  • Grammar concepts learned                    │    │
│  │  • Pronunciation progress                      │    │
│  │  • Practice history                            │    │
│  │  • Spaced repetition schedule                  │    │
│  │                                                 │    │
│  │  Storage: PostgreSQL + time-series data        │    │
│  │  Retrieval: Aggregated queries with recency    │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 1. Episodic Memory: "What Happened"

### Purpose
Remember specific interactions, struggles, breakthroughs, and emotional moments.

### Schema Design

```sql
CREATE TABLE episodic_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Conversation content
  user_message TEXT NOT NULL,
  agent_message TEXT NOT NULL,
  conversation_id UUID, -- Group related turns

  -- Semantic search
  embedding vector(1536), -- OpenAI ada-002 or similar
  topics TEXT[], -- Extracted topics: ['pronunciation', 'th-sound', 'frustration']

  -- Context
  session_id UUID,
  detected_emotion TEXT, -- 'frustrated', 'excited', 'confused', 'confident'
  learning_activity TEXT, -- '4-3-2 practice', 'vocabulary drill', 'free conversation'

  -- Tools & actions
  tools_used TEXT[], -- Which tools were called
  learning_outcome TEXT, -- 'mastered', 'struggled', 'practiced', 'reviewed'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for fast retrieval
  INDEX idx_episodic_user_time (user_id, timestamp DESC),
  INDEX idx_episodic_embedding USING ivfflat (embedding vector_cosine_ops),
  INDEX idx_episodic_topics USING gin(topics)
);
```

### Storage Strategy

**When to store**:
- Every user turn in a conversation
- Significant learning events (breakthrough, struggle, mastery)
- Emotional moments (frustration, excitement)
- Tool usage that had impact

**What to embed**:
```typescript
async function storeEpisodicMemory(turn: ConversationTurn) {
  // Create rich text for embedding
  const textToEmbed = `
    User (${turn.detectedEmotion}): ${turn.userMessage}
    Context: ${turn.learningActivity}
    Agent response: ${turn.agentMessage}
    Topics: ${turn.topics.join(', ')}
    Outcome: ${turn.learningOutcome}
  `;

  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: textToEmbed,
  });

  await db.query(`
    INSERT INTO episodic_memory (
      user_id, user_message, agent_message, embedding,
      topics, detected_emotion, learning_activity,
      tools_used, learning_outcome, conversation_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    turn.userId,
    turn.userMessage,
    turn.agentMessage,
    embedding.data[0].embedding,
    turn.topics,
    turn.detectedEmotion,
    turn.learningActivity,
    turn.toolsUsed,
    turn.learningOutcome,
    turn.conversationId,
  ]);
}
```

### Retrieval Strategy

**Goal**: Find the most relevant past experiences for current context

```typescript
async function retrieveEpisodicMemory(
  userId: string,
  currentMessage: string,
  limit: number = 5,
) {
  // 1. Embed current message
  const currentEmbedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: currentMessage,
  });

  // 2. Hybrid search: Vector similarity + recency + importance
  const results = await db.query(`
    WITH similarity_scores AS (
      SELECT
        *,
        1 - (embedding <=> $1::vector) as similarity,
        -- Recency bonus: Recent memories are more relevant
        EXTRACT(EPOCH FROM (NOW() - timestamp)) / 86400 as days_ago,
        -- Importance: Emotional moments are more important
        CASE
          WHEN detected_emotion IN ('frustrated', 'breakthrough', 'excited') THEN 0.2
          WHEN learning_outcome IN ('mastered', 'struggled') THEN 0.15
          ELSE 0
        END as importance_boost
      FROM episodic_memory
      WHERE user_id = $2
    )
    SELECT
      *,
      -- Combined score: similarity + recency decay + importance
      (similarity * 0.7) +
      (1 / (1 + days_ago * 0.1)) * 0.2 +
      importance_boost as final_score
    FROM similarity_scores
    WHERE similarity > 0.5 -- Minimum relevance threshold
    ORDER BY final_score DESC
    LIMIT $3
  `, [currentEmbedding.data[0].embedding, userId, limit]);

  return results.rows;
}
```

**Smart Retrieval Examples**:

1. **Time-aware**: "Yesterday you struggled with..." (recent memories weighted higher)
2. **Emotion-aware**: Retrieve past frustration moments if user seems frustrated now
3. **Topic-aware**: If discussing pronunciation, retrieve pronunciation-related memories
4. **Pattern-aware**: Detect recurring struggles across multiple episodes

### Memory Decay & Consolidation

**Challenge**: Can't keep all memories forever (cost, noise)

**Strategy**: Consolidate old memories into semantic knowledge

```typescript
// Run nightly
async function consolidateOldMemories() {
  // Find episodic memories older than 90 days
  const oldMemories = await db.query(`
    SELECT user_id, topics, detected_emotion, learning_outcome, COUNT(*) as occurrences
    FROM episodic_memory
    WHERE timestamp < NOW() - INTERVAL '90 days'
    GROUP BY user_id, topics, detected_emotion, learning_outcome
    HAVING COUNT(*) > 3  -- Only patterns, not one-offs
  `);

  // Move patterns to semantic memory
  for (const pattern of oldMemories.rows) {
    await db.query(`
      INSERT INTO user_profile_insights (user_id, insight_type, data)
      VALUES ($1, 'recurring_struggle', $2)
      ON CONFLICT (user_id, insight_type) DO UPDATE
      SET data = user_profile_insights.data || $2
    `, [pattern.user_id, {
      topics: pattern.topics,
      emotion: pattern.detected_emotion,
      occurrences: pattern.occurrences,
      consolidated_from: 'episodic_memory',
    }]);
  }

  // Delete consolidated memories (keep high-importance ones)
  await db.query(`
    DELETE FROM episodic_memory
    WHERE timestamp < NOW() - INTERVAL '90 days'
      AND detected_emotion NOT IN ('breakthrough', 'mastered')
  `);
}
```

## 2. Semantic Memory: "What Is True"

### Purpose
Store factual knowledge about the user: preferences, learning style, personality, goals.

### Schema Design

```sql
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id),

  -- Basic info
  learner_name TEXT,
  native_language TEXT,
  target_language TEXT,
  proficiency_level TEXT, -- A1, A2, B1, B2, C1, C2

  -- Learning preferences
  preferred_tutor_name TEXT DEFAULT 'Alex',
  session_preference TEXT, -- 'short_frequent', 'long_focused', 'flexible'
  preferred_session_duration INTEGER, -- minutes
  learning_style TEXT[], -- ['visual', 'auditory', 'kinesthetic', 'reading']
  preferred_practice_types TEXT[], -- ['conversation', 'drills', '4-3-2', 'vocabulary']

  -- Personality traits (inferred over time)
  personality_traits JSONB, -- { "responds_well_to": "encouragement", "gets_frustrated_easily": true }
  motivations TEXT[], -- ['travel', 'career', 'family', 'personal_growth']
  goals TEXT[], -- ['speak_confidently', 'reduce_accent', 'expand_vocabulary']

  -- Metadata
  timezone TEXT,
  preferred_practice_time TEXT, -- 'morning', 'lunch', 'evening'

  -- Stats
  total_sessions INTEGER DEFAULT 0,
  total_practice_minutes INTEGER DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,

  -- Adaptive settings
  difficulty_level INTEGER DEFAULT 5, -- 1-10 scale
  speech_rate_preference NUMERIC DEFAULT 1.0, -- TTS speed (0.8-1.2)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insights derived from episodic memory
CREATE TABLE user_profile_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  insight_type TEXT, -- 'recurring_struggle', 'learning_pattern', 'preference'
  data JSONB,
  confidence NUMERIC, -- 0-1, how confident we are in this insight
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, insight_type)
);
```

### Learning from Behavior

**Inferring Preferences**:
```typescript
async function inferUserPreferences(userId: string) {
  // Example: Infer learning style from behavior
  const behaviorAnalysis = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE learning_activity LIKE '%visual%') as visual_count,
      COUNT(*) FILTER (WHERE learning_activity LIKE '%listening%') as auditory_count,
      COUNT(*) FILTER (WHERE learning_activity LIKE '%conversation%') as conversation_count,
      AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) as avg_session_minutes
    FROM sessions
    WHERE user_id = $1
  `, [userId]);

  const preferences = {
    learning_style: [],
    preferred_session_duration: Math.round(behaviorAnalysis.rows[0].avg_session_minutes),
  };

  if (behaviorAnalysis.rows[0].visual_count > 10) {
    preferences.learning_style.push('visual');
  }
  if (behaviorAnalysis.rows[0].auditory_count > 10) {
    preferences.learning_style.push('auditory');
  }

  await db.query(`
    UPDATE user_profiles
    SET learning_style = $1,
        preferred_session_duration = $2,
        updated_at = NOW()
    WHERE user_id = $3
  `, [preferences.learning_style, preferences.preferred_session_duration, userId]);
}
```

**Detecting Personality Traits**:
```typescript
async function updatePersonalityTraits(userId: string) {
  // Analyze emotional patterns from episodic memory
  const emotionalPatterns = await db.query(`
    SELECT
      detected_emotion,
      COUNT(*) as occurrences,
      AVG(CASE
        WHEN learning_outcome = 'mastered' THEN 1
        WHEN learning_outcome = 'struggled' THEN -1
        ELSE 0
      END) as outcome_sentiment
    FROM episodic_memory
    WHERE user_id = $1
      AND timestamp > NOW() - INTERVAL '30 days'
    GROUP BY detected_emotion
  `, [userId]);

  const traits = {};

  const frustrationCount = emotionalPatterns.rows.find(r => r.detected_emotion === 'frustrated')?.occurrences || 0;
  if (frustrationCount > 5) {
    traits.gets_frustrated_easily = true;
    traits.responds_well_to = 'encouragement';
  }

  const excitementCount = emotionalPatterns.rows.find(r => r.detected_emotion === 'excited')?.occurrences || 0;
  if (excitementCount > 10) {
    traits.enthusiastic_learner = true;
    traits.responds_well_to = 'challenges';
  }

  await db.query(`
    UPDATE user_profiles
    SET personality_traits = $1,
        updated_at = NOW()
    WHERE user_id = $2
  `, [traits, userId]);
}
```

### Retrieval Strategy

**Simple and fast** (direct query by user_id):
```typescript
async function retrieveSemanticMemory(userId: string) {
  const profile = await db.query(`
    SELECT * FROM user_profiles WHERE user_id = $1
  `, [userId]);

  const insights = await db.query(`
    SELECT * FROM user_profile_insights
    WHERE user_id = $1 AND confidence > 0.7
    ORDER BY created_at DESC
  `, [userId]);

  return {
    profile: profile.rows[0],
    insights: insights.rows,
  };
}
```

## 3. Learning Memory: "What They Know"

### Purpose
Track educational progress: vocabulary, grammar, pronunciation, practice history.

### Schema Design

```sql
-- Vocabulary tracking
CREATE TABLE user_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  word TEXT NOT NULL,
  definition TEXT,

  -- Mastery tracking
  mastery_level INTEGER DEFAULT 0, -- 0-10
  first_encountered TIMESTAMPTZ DEFAULT NOW(),
  last_practiced TIMESTAMPTZ,
  practice_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,

  -- Spaced repetition
  next_review TIMESTAMPTZ,
  review_interval_days INTEGER DEFAULT 1,
  ease_factor NUMERIC DEFAULT 2.5, -- SM-2 algorithm

  -- Context
  learned_in_context TEXT, -- Example sentence where learned
  difficulty_when_learned INTEGER, -- User's level when learned

  UNIQUE(user_id, word)
);

CREATE INDEX idx_vocab_next_review ON user_vocabulary(user_id, next_review)
  WHERE next_review IS NOT NULL;

-- Pronunciation tracking
CREATE TABLE pronunciation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  word TEXT NOT NULL,
  phoneme TEXT, -- Specific sound: 'th', 'r', 'v', etc.

  -- Assessment
  quality TEXT, -- 'poor', 'fair', 'good', 'excellent'
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Details
  attempted_pronunciation TEXT, -- IPA or phonetic transcription
  target_pronunciation TEXT,
  confidence_score NUMERIC, -- From STT/analysis

  notes TEXT,

  INDEX idx_pronunciation_user_word (user_id, word, timestamp DESC)
);

-- Fluency tracking (4-3-2 sessions)
CREATE TABLE fluency_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  session_date TIMESTAMPTZ DEFAULT NOW(),

  topic TEXT,

  -- Metrics per round
  round_1_wpm INTEGER,
  round_1_filler_words INTEGER,
  round_1_unique_words INTEGER,

  round_2_wpm INTEGER,
  round_2_filler_words INTEGER,
  round_2_unique_words INTEGER,

  round_3_wpm INTEGER,
  round_3_filler_words INTEGER,
  round_3_unique_words INTEGER,

  -- Progress
  wpm_improvement_percent NUMERIC,
  fluency_score NUMERIC, -- 0-10

  INDEX idx_fluency_user_date (user_id, session_date DESC)
);

-- Practice history (aggregate)
CREATE TABLE practice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  practice_date DATE DEFAULT CURRENT_DATE,

  -- Time
  total_minutes INTEGER DEFAULT 0,
  activity_breakdown JSONB, -- { "conversation": 15, "vocabulary": 10, "pronunciation": 5 }

  -- Performance
  vocabulary_practiced INTEGER DEFAULT 0,
  vocabulary_mastered INTEGER DEFAULT 0,
  pronunciation_attempts INTEGER DEFAULT 0,
  fluency_sessions INTEGER DEFAULT 0,

  -- Engagement
  session_count INTEGER DEFAULT 0,

  UNIQUE(user_id, practice_date)
);
```

### Spaced Repetition Implementation

Based on research from SKILL.md:

```typescript
async function scheduleNextReview(
  userId: string,
  word: string,
  performance: 'poor' | 'fair' | 'good' | 'excellent',
) {
  const vocab = await db.query(`
    SELECT * FROM user_vocabulary
    WHERE user_id = $1 AND word = $2
  `, [userId, word]);

  const item = vocab.rows[0];

  // SM-2 algorithm with modifications
  let newEaseFactor = item.ease_factor;
  let newInterval = item.review_interval_days;

  switch (performance) {
    case 'poor':
      newInterval = 1; // Reset to 1 day
      newEaseFactor = Math.max(1.3, item.ease_factor - 0.2);
      break;

    case 'fair':
      newInterval = Math.max(1, item.review_interval_days);
      newEaseFactor = Math.max(1.3, item.ease_factor - 0.15);
      break;

    case 'good':
      if (item.practice_count === 0) {
        newInterval = 1;
      } else if (item.practice_count === 1) {
        newInterval = 7; // First review after 7 days (research-backed)
      } else {
        newInterval = Math.round(item.review_interval_days * item.ease_factor);
      }
      break;

    case 'excellent':
      if (item.practice_count === 0) {
        newInterval = 1;
      } else if (item.practice_count === 1) {
        newInterval = 7;
      } else {
        newInterval = Math.round(item.review_interval_days * item.ease_factor * 1.3);
      }
      newEaseFactor = item.ease_factor + 0.1;
      break;
  }

  // Cap at reasonable max (6 months)
  newInterval = Math.min(newInterval, 180);

  await db.query(`
    UPDATE user_vocabulary
    SET
      last_practiced = NOW(),
      practice_count = practice_count + 1,
      correct_count = correct_count + CASE WHEN $3 IN ('good', 'excellent') THEN 1 ELSE 0 END,
      incorrect_count = incorrect_count + CASE WHEN $3 IN ('poor', 'fair') THEN 1 ELSE 0 END,
      review_interval_days = $4,
      ease_factor = $5,
      next_review = NOW() + INTERVAL '1 day' * $4,
      mastery_level = LEAST(10, GREATEST(0,
        mastery_level + CASE
          WHEN $3 = 'excellent' THEN 2
          WHEN $3 = 'good' THEN 1
          WHEN $3 = 'fair' THEN 0
          WHEN $3 = 'poor' THEN -1
        END
      ))
    WHERE user_id = $1 AND word = $2
  `, [userId, word, performance, newInterval, newEaseFactor]);
}
```

### Retrieval Strategy

**Get current learning state**:
```typescript
async function retrieveLearningMemory(userId: string) {
  // Parallel queries for speed
  const [
    vocabStats,
    upcomingReviews,
    recentPronunciation,
    fluencyProgress,
    weekStats,
  ] = await Promise.all([
    // Vocabulary overview
    db.query(`
      SELECT
        COUNT(*) as total_words,
        COUNT(*) FILTER (WHERE mastery_level >= 7) as mastered_words,
        AVG(mastery_level) as avg_mastery
      FROM user_vocabulary
      WHERE user_id = $1
    `, [userId]),

    // Upcoming reviews (due soon)
    db.query(`
      SELECT word, next_review, mastery_level
      FROM user_vocabulary
      WHERE user_id = $1
        AND next_review BETWEEN NOW() AND NOW() + INTERVAL '3 days'
      ORDER BY next_review
      LIMIT 10
    `, [userId]),

    // Recent pronunciation struggles
    db.query(`
      SELECT word, phoneme, quality, COUNT(*) as attempts
      FROM pronunciation_log
      WHERE user_id = $1
        AND timestamp > NOW() - INTERVAL '7 days'
        AND quality IN ('poor', 'fair')
      GROUP BY word, phoneme, quality
      ORDER BY attempts DESC
      LIMIT 5
    `, [userId]),

    // Fluency trend
    db.query(`
      SELECT
        session_date,
        round_3_wpm,
        wpm_improvement_percent,
        fluency_score
      FROM fluency_sessions
      WHERE user_id = $1
      ORDER BY session_date DESC
      LIMIT 5
    `, [userId]),

    // This week's stats
    db.query(`
      SELECT
        SUM(total_minutes) as minutes_practiced,
        SUM(vocabulary_mastered) as words_mastered,
        SUM(session_count) as sessions
      FROM practice_history
      WHERE user_id = $1
        AND practice_date >= DATE_TRUNC('week', CURRENT_DATE)
    `, [userId]),
  ]);

  return {
    vocabulary: {
      total: vocabStats.rows[0].total_words,
      mastered: vocabStats.rows[0].mastered_words,
      avgMastery: vocabStats.rows[0].avg_mastery,
    },
    upcomingReviews: upcomingReviews.rows,
    pronunciationStruggles: recentPronunciation.rows,
    fluencyTrend: fluencyProgress.rows,
    weekStats: weekStats.rows[0],
  };
}
```

## Integration: Using All Three Memories Together

```typescript
async function getFullMemoryContext(userId: string, currentMessage: string) {
  const [episodic, semantic, learning] = await Promise.all([
    retrieveEpisodicMemory(userId, currentMessage),
    retrieveSemanticMemory(userId),
    retrieveLearningMemory(userId),
  ]);

  // Synthesize into natural language context
  return {
    raw: { episodic, semantic, learning },
    summary: generateMemorySummary(episodic, semantic, learning),
  };
}

function generateMemorySummary(episodic, semantic, learning) {
  return `
# WHO THIS STUDENT IS
${semantic.profile.learner_name} is learning ${semantic.profile.target_language} (currently ${semantic.profile.proficiency_level} level).
They prefer ${semantic.profile.session_preference} sessions and learn best with ${semantic.profile.learning_style.join(', ')} approaches.
${semantic.profile.personality_traits.gets_frustrated_easily ? 'They can get frustrated, so be encouraging.' : ''}

# WHAT THEY KNOW
- Vocabulary: ${learning.vocabulary.mastered}/${learning.vocabulary.total} words mastered
- This week: ${learning.weekStats.minutes_practiced} minutes practiced, ${learning.weekStats.words_mastered} words learned
${learning.fluencyTrend.length > 0 ? `- Latest fluency: ${learning.fluencyTrend[0].round_3_wpm} WPM (${learning.fluencyTrend[0].wpm_improvement_percent > 0 ? '+' + learning.fluencyTrend[0].wpm_improvement_percent + '%' : 'baseline'})` : ''}

# WHAT TO WORK ON
${learning.pronunciationStruggles.length > 0 ? `- Pronunciation: Struggling with ${learning.pronunciationStruggles.map(s => s.phoneme + ' in "' + s.word + '"').join(', ')}` : ''}
${learning.upcomingReviews.length > 0 ? `- Reviews due: ${learning.upcomingReviews.map(r => r.word).slice(0, 3).join(', ')}` : ''}

# RELEVANT RECENT MEMORIES
${episodic.map(ep => `- ${formatTimestamp(ep.timestamp)}: ${ep.detected_emotion ? '[' + ep.detected_emotion + '] ' : ''}${ep.user_message.slice(0, 100)}...`).join('\n')}
`;
}
```

## Privacy & Ethics

### User Control
- Users can view all stored memories
- Users can delete specific memories
- Users can export all their data
- Users can pause memory collection

### Data Retention
- Episodic memory: 90 days, then consolidated
- Semantic memory: Indefinite (user profile)
- Learning memory: Indefinite (educational progress)
- Audio recordings: Deleted after transcription (unless user opts in)

### Anonymization
- Memory data anonymized for training
- No PII in embeddings
- Separate encryption for sensitive data

---

**Next**: See `04-TOOLS.md` for educational tool implementations.
