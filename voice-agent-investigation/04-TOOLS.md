# Educational Tools: Making the Agent Capable

## Tool Philosophy

**Generic voice assistants answer questions.**
**Agentic language tutors take actions that advance learning.**

Tools are how the agent moves from conversation to intervention.

## Tool Categories

```
┌──────────────────────────────────────────────────────┐
│                   TOOL ECOSYSTEM                      │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  ASSESSMENT TOOLS                           │    │
│  │  ────────────────                           │    │
│  │  • query_user_vocabulary                    │    │
│  │  • assess_pronunciation                     │    │
│  │  • check_grammar_understanding              │    │
│  │  • get_learning_stats                       │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  PRACTICE GENERATION TOOLS                  │    │
│  │  ─────────────────────────                  │    │
│  │  • generate_practice_sentence               │    │
│  │  • create_4_3_2_topic                       │    │
│  │  • generate_pronunciation_drill             │    │
│  │  • suggest_conversation_starter             │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  SCHEDULING & TRACKING TOOLS                │    │
│  │  ───────────────────────────                │    │
│  │  • schedule_spaced_review                   │    │
│  │  • track_pronunciation_attempt              │    │
│  │  • log_vocabulary_practice                  │    │
│  │  • record_fluency_session                   │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  ADAPTIVE LEARNING TOOLS                    │    │
│  │  ───────────────────────                    │    │
│  │  • adjust_difficulty                        │    │
│  │  • update_learning_path                     │    │
│  │  • set_personalized_goal                    │    │
│  │  • recommend_next_activity                  │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  ┌─────────────────────────────────────────────┐    │
│  │  FEEDBACK & ENCOURAGEMENT TOOLS             │    │
│  │  ──────────────────────────────             │    │
│  │  • celebrate_milestone                      │    │
│  │  • provide_error_analysis                   │    │
│  │  • suggest_learning_strategy                │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

## Tool Definitions & Implementations

### 1. Assessment Tools

#### query_user_vocabulary
**Purpose**: Check what words the user knows, enabling level-appropriate practice generation.

**Definition**:
```typescript
{
  type: "function",
  function: {
    name: "query_user_vocabulary",
    description: "Check which words/phrases the user already knows and their mastery levels. Use this before generating practice content to ensure it matches the user's level.",
    parameters: {
      type: "object",
      properties: {
        words: {
          type: "array",
          items: { type: "string" },
          description: "Words or phrases to check. Can also use null to get general vocabulary stats."
        },
        get_similar: {
          type: "boolean",
          description: "If true, also return words at similar difficulty level"
        }
      }
    }
  }
}
```

**Implementation**:
```typescript
async function query_user_vocabulary(userId: string, words: string[] | null, getSimilar: boolean = false) {
  if (words === null) {
    // General stats
    return await db.query(`
      SELECT
        COUNT(*) as total_words,
        COUNT(*) FILTER (WHERE mastery_level >= 7) as mastered,
        COUNT(*) FILTER (WHERE mastery_level BETWEEN 4 AND 6) as learning,
        COUNT(*) FILTER (WHERE mastery_level < 4) as struggling,
        AVG(mastery_level) as avg_mastery
      FROM user_vocabulary
      WHERE user_id = $1
    `, [userId]);
  }

  const results = await db.query(`
    SELECT
      word,
      mastery_level,
      last_practiced,
      practice_count,
      ROUND(100.0 * correct_count / NULLIF(practice_count, 0), 1) as accuracy_percent
    FROM user_vocabulary
    WHERE user_id = $1 AND word = ANY($2)
  `, [userId, words]);

  if (getSimilar && results.rows.length > 0) {
    const avgMastery = results.rows.reduce((sum, r) => sum + r.mastery_level, 0) / results.rows.length;

    const similar = await db.query(`
      SELECT word, mastery_level
      FROM user_vocabulary
      WHERE user_id = $1
        AND mastery_level BETWEEN $2 - 1 AND $2 + 1
        AND word != ALL($3)
      ORDER BY RANDOM()
      LIMIT 10
    `, [userId, avgMastery, words]);

    return {
      queried: results.rows,
      similar: similar.rows,
    };
  }

  return { queried: results.rows };
}
```

**Usage Example**:
```
User: "Can we practice words about cooking?"
Agent: [Calls query_user_vocabulary with cooking-related words]
Agent: "Great! I see you've mastered 'chop', 'boil', and 'fry', but 'sauté' and 'simmer' are new for you. Let's practice those!"
```

#### assess_pronunciation
**Purpose**: Analyze pronunciation quality from STT output.

**Definition**:
```typescript
{
  type: "function",
  function: {
    name: "assess_pronunciation",
    description: "Analyze pronunciation quality of a word or phrase based on speech-to-text output. Returns phonetic analysis and specific feedback.",
    parameters: {
      type: "object",
      properties: {
        target_word: {
          type: "string",
          description: "The word/phrase that was supposed to be pronounced"
        },
        actual_transcription: {
          type: "string",
          description: "What the STT heard"
        },
        word_timings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              word: { type: "string" },
              start: { type: "number" },
              end: { type: "number" },
              confidence: { type: "number" }
            }
          },
          description: "Word-level timing and confidence from Deepgram"
        }
      },
      required: ["target_word", "actual_transcription"]
    }
  }
}
```

**Implementation**:
```typescript
async function assess_pronunciation(
  targetWord: string,
  actualTranscription: string,
  wordTimings?: Array<{ word: string; confidence: number }>
) {
  // 1. Exact match
  if (targetWord.toLowerCase() === actualTranscription.toLowerCase()) {
    const confidence = wordTimings?.[0]?.confidence || 0.95;
    return {
      quality: confidence > 0.9 ? 'excellent' : 'good',
      confidence: confidence,
      feedback: 'Perfect pronunciation!',
      phonetic_issues: []
    };
  }

  // 2. Phonetic analysis (using phonetic similarity library)
  const targetPhonetic = metaphone(targetWord);
  const actualPhonetic = metaphone(actualTranscription);
  const similarity = levenshteinSimilarity(targetPhonetic, actualPhonetic);

  // 3. Identify specific issues
  const issues = [];

  // Common ESL issues detection
  if (targetWord.includes('th') && !actualTranscription.includes('th')) {
    issues.push({
      phoneme: 'th',
      problem: 'Substituted with t/d or s/z',
      suggestion: 'Place tongue between teeth'
    });
  }

  if (targetWord.includes('r') && actualTranscription.includes('l')) {
    issues.push({
      phoneme: 'r',
      problem: 'Confused with l',
      suggestion: 'Curl tongue back without touching roof of mouth'
    });
  }

  // Determine quality
  let quality: 'poor' | 'fair' | 'good' | 'excellent';
  if (similarity > 0.9) quality = 'good';
  else if (similarity > 0.7) quality = 'fair';
  else quality = 'poor';

  return {
    quality,
    similarity,
    confidence: wordTimings?.[0]?.confidence || 0.5,
    feedback: generatePronunciationFeedback(quality, issues),
    phonetic_issues: issues,
    target_ipa: getIPA(targetWord),
    actual_ipa: getIPA(actualTranscription)
  };
}

function generatePronunciationFeedback(quality: string, issues: any[]) {
  if (quality === 'excellent' || quality === 'good') {
    return 'Great pronunciation! Very clear.';
  }

  if (issues.length > 0) {
    return `Let's work on the "${issues[0].phoneme}" sound. ${issues[0].suggestion}`;
  }

  return 'Good attempt! Let\'s practice this word a few more times.';
}
```

#### get_learning_stats
**Purpose**: Retrieve progress statistics to celebrate wins and identify areas for improvement.

**Definition**:
```typescript
{
  type: "function",
  function: {
    name: "get_learning_stats",
    description: "Get detailed learning statistics and progress metrics for motivation and assessment",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          enum: ["today", "week", "month", "all_time"],
          description: "Time period for statistics"
        },
        include_trends: {
          type: "boolean",
          description: "Include trend analysis (improving, declining, stable)"
        }
      },
      required: ["timeframe"]
    }
  }
}
```

**Implementation**:
```typescript
async function get_learning_stats(userId: string, timeframe: string, includeTrends: boolean = false) {
  const timeCondition = {
    today: "practice_date = CURRENT_DATE",
    week: "practice_date >= DATE_TRUNC('week', CURRENT_DATE)",
    month: "practice_date >= DATE_TRUNC('month', CURRENT_DATE)",
    all_time: "TRUE"
  }[timeframe];

  const stats = await db.query(`
    SELECT
      SUM(total_minutes) as total_minutes,
      SUM(vocabulary_practiced) as words_practiced,
      SUM(vocabulary_mastered) as words_mastered,
      SUM(pronunciation_attempts) as pronunciation_attempts,
      SUM(fluency_sessions) as fluency_sessions,
      SUM(session_count) as total_sessions,
      AVG(total_minutes) as avg_daily_minutes
    FROM practice_history
    WHERE user_id = $1 AND ${timeCondition}
  `, [userId]);

  const result = stats.rows[0];

  if (includeTrends) {
    // Compare to previous period
    const previousPeriodCondition = {
      today: "practice_date = CURRENT_DATE - INTERVAL '1 day'",
      week: "practice_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND practice_date < DATE_TRUNC('week', CURRENT_DATE)",
      month: "practice_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND practice_date < DATE_TRUNC('month', CURRENT_DATE)",
      all_time: "FALSE"
    }[timeframe];

    const previousStats = await db.query(`
      SELECT
        SUM(total_minutes) as total_minutes,
        SUM(vocabulary_mastered) as words_mastered
      FROM practice_history
      WHERE user_id = $1 AND ${previousPeriodCondition}
    `, [userId]);

    const prev = previousStats.rows[0];
    result.trends = {
      minutes: calculateTrend(result.total_minutes, prev.total_minutes),
      words_mastered: calculateTrend(result.words_mastered, prev.words_mastered)
    };
  }

  return result;
}

function calculateTrend(current: number, previous: number) {
  if (!previous) return 'new';
  const change = ((current - previous) / previous) * 100;
  if (change > 10) return 'improving';
  if (change < -10) return 'declining';
  return 'stable';
}
```

### 2. Practice Generation Tools

#### generate_practice_sentence
**Purpose**: Create personalized practice sentences using user's vocabulary level.

**Definition**:
```typescript
{
  type: "function",
  function: {
    name: "generate_practice_sentence",
    description: "Generate a practice sentence at the user's level, optionally including specific target words",
    parameters: {
      type: "object",
      properties: {
        target_words: {
          type: "array",
          items: { type: "string" },
          description: "Words that must be included in the sentence"
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard"],
          description: "Sentence complexity level"
        },
        topic: {
          type: "string",
          description: "Topic/theme for the sentence (e.g., 'cooking', 'travel', 'work')"
        },
        count: {
          type: "number",
          description: "Number of sentences to generate (default: 1)"
        }
      }
    }
  }
}
```

**Implementation**:
```typescript
async function generate_practice_sentence(
  userId: string,
  targetWords: string[],
  difficulty: 'easy' | 'medium' | 'hard',
  topic?: string,
  count: number = 1
) {
  // Get user's known vocabulary for context
  const userVocab = await db.query(`
    SELECT word FROM user_vocabulary
    WHERE user_id = $1 AND mastery_level >= 5
    LIMIT 100
  `, [userId]);

  const knownWords = userVocab.rows.map(r => r.word);

  // Use LLM to generate sentences
  const prompt = `Generate ${count} practice sentence(s) for an ESL learner.

Requirements:
- Include these words: ${targetWords.join(', ')}
${topic ? `- Topic: ${topic}` : ''}
- Difficulty: ${difficulty}
- Use vocabulary the learner knows: ${knownWords.slice(0, 20).join(', ')}...

Difficulty guidelines:
- Easy: Simple present/past tense, 6-10 words, common words
- Medium: Mixed tenses, 10-15 words, some idioms
- Hard: Complex structures, 15+ words, advanced vocabulary

Return JSON array of objects with: { sentence: string, translation: string, grammar_focus: string }`;

  const response = await llamaClient.chat.completions.create({
    model: "llama-3.3-70b-instruct",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    response_format: { type: "json_object" }
  });

  const sentences = JSON.parse(response.choices[0].message.content);

  // Store generated sentences for future reference
  for (const sent of sentences.sentences) {
    await db.query(`
      INSERT INTO generated_practice_content (user_id, type, content, difficulty, metadata)
      VALUES ($1, 'sentence', $2, $3, $4)
    `, [userId, sent.sentence, difficulty, { topic, target_words: targetWords, translation: sent.translation }]);
  }

  return sentences;
}
```

#### create_4_3_2_topic
**Purpose**: Generate a topic for the 4-3-2 fluency technique.

**Definition**:
```typescript
{
  type: "function",
  function: {
    name: "create_4_3_2_topic",
    description: "Generate a personalized topic for 4-3-2 fluency practice based on user's interests and level",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["personal", "descriptive", "opinion", "storytelling"],
          description: "Type of topic"
        },
        difficulty: {
          type: "string",
          enum: ["easy", "medium", "hard"]
        }
      },
      required: ["category"]
    }
  }
}
```

**Implementation**:
```typescript
async function create_4_3_2_topic(
  userId: string,
  category: 'personal' | 'descriptive' | 'opinion' | 'storytelling',
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
) {
  const profile = await db.query(`
    SELECT motivations, goals, personality_traits
    FROM user_profiles
    WHERE user_id = $1
  `, [userId]);

  const user = profile.rows[0];

  const topicTemplates = {
    personal: {
      easy: [
        "Describe your favorite food and why you like it",
        "Talk about your daily routine",
        "Describe your family"
      ],
      medium: [
        "Explain a hobby you're passionate about",
        "Describe a challenge you've overcome",
        "Talk about your goals for this year"
      ],
      hard: [
        "Discuss how your values have changed over time",
        "Explain a complex decision you had to make recently"
      ]
    },
    opinion: {
      easy: [
        "What's better: city life or country life?",
        "Should everyone learn a second language?"
      ],
      medium: [
        "How has technology changed education?",
        "What makes a good friend?"
      ],
      hard: [
        "How should society balance tradition and progress?",
        "What role should governments play in personal health choices?"
      ]
    }
    // ... more categories
  };

  const topics = topicTemplates[category][difficulty];
  const selectedTopic = topics[Math.floor(Math.random() * topics.length)];

  // Personalize based on user profile
  let personalizedTopic = selectedTopic;
  if (user.motivations?.includes('travel')) {
    personalizedTopic += " (relate to your travel experiences)";
  }

  return {
    topic: personalizedTopic,
    category,
    difficulty,
    tips: [
      "Speak for the full time, even if you pause",
      "Don't worry about perfection in Round 1",
      "Focus on fluency, not accuracy"
    ],
    example_structure: category === 'opinion' ?
      "Introduction → Your opinion → Reason 1 → Reason 2 → Conclusion" :
      "Introduction → Main points → Details → Conclusion"
  };
}
```

### 3. Scheduling & Tracking Tools

#### schedule_spaced_review
**Purpose**: Implement research-backed spaced repetition scheduling.

**Definition**:
```typescript
{
  type: "function",
  function: {
    name: "schedule_spaced_review",
    description: "Schedule vocabulary/grammar reviews using spaced repetition (based on SKILL.md research: 7, 14, 28 day intervals)",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: { type: "string" },
          description: "Words, phrases, or grammar concepts to review"
        },
        interval_days: {
          type: "number",
          description: "Days until review. Use research-backed intervals: 7, 14, 28, 56"
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Review priority"
        }
      },
      required: ["items", "interval_days"]
    }
  }
}
```

**Implementation**:
```typescript
async function schedule_spaced_review(
  userId: string,
  items: string[],
  intervalDays: number,
  priority: 'low' | 'normal' | 'high' = 'normal'
) {
  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + intervalDays);

  const result = await db.query(`
    INSERT INTO spaced_reviews (user_id, items, scheduled_date, priority, interval_days)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, scheduled_date
  `, [userId, items, scheduledDate, priority, intervalDays]);

  // Update the vocabulary items
  await db.query(`
    UPDATE user_vocabulary
    SET next_review = $2,
        review_interval_days = $3
    WHERE user_id = $1 AND word = ANY($4)
  `, [userId, scheduledDate, intervalDays, items]);

  return {
    review_id: result.rows[0].id,
    scheduled_for: result.rows[0].scheduled_date,
    items_count: items.length,
    interval_days: intervalDays
  };
}
```

#### track_pronunciation_attempt
**Purpose**: Log pronunciation practice for progress tracking.

**Implementation**: (See pronunciation_log table in 03-MEMORY.md)

### 4. Adaptive Learning Tools

#### adjust_difficulty
**Purpose**: Dynamically adjust difficulty based on user performance.

**Definition**:
```typescript
{
  type: "function",
  function: {
    name: "adjust_difficulty",
    description: "Adjust the user's difficulty level based on performance. Use when user is struggling (too hard) or bored (too easy).",
    parameters: {
      type: "object",
      properties: {
        direction: {
          type: "string",
          enum: ["easier", "harder"],
          description: "Which way to adjust"
        },
        reason: {
          type: "string",
          description: "Why you're adjusting (for logging and transparency)"
        },
        amount: {
          type: "number",
          description: "How much to adjust (1 = small, 2 = medium, 3 = large)"
        }
      },
      required: ["direction", "reason"]
    }
  }
}
```

**Implementation**:
```typescript
async function adjust_difficulty(
  userId: string,
  direction: 'easier' | 'harder',
  reason: string,
  amount: number = 1
) {
  const change = direction === 'harder' ? amount : -amount;

  const result = await db.query(`
    UPDATE user_profiles
    SET
      difficulty_level = GREATEST(1, LEAST(10, difficulty_level + $2)),
      last_difficulty_adjustment = NOW(),
      difficulty_adjustment_reason = $3
    WHERE user_id = $1
    RETURNING difficulty_level
  `, [userId, change, reason]);

  // Log the adjustment
  await db.query(`
    INSERT INTO difficulty_adjustments (user_id, direction, amount, reason, new_level)
    VALUES ($1, $2, $3, $4, $5)
  `, [userId, direction, amount, reason, result.rows[0].difficulty_level]);

  return {
    new_level: result.rows[0].difficulty_level,
    direction,
    reason
  };
}
```

### 5. Feedback & Encouragement Tools

#### celebrate_milestone
**Purpose**: Recognize achievements and maintain motivation.

**Definition**:
```typescript
{
  type: "function",
  function: {
    name: "celebrate_milestone",
    description: "Celebrate user achievements and milestones. Use when user reaches significant goals.",
    parameters: {
      type: "object",
      properties: {
        milestone_type: {
          type: "string",
          enum: ["vocabulary_milestone", "streak", "fluency_improvement", "pronunciation_mastery", "custom"],
          description: "Type of milestone"
        },
        details: {
          type: "object",
          description: "Details about the achievement"
        }
      },
      required: ["milestone_type"]
    }
  }
}
```

**Implementation**:
```typescript
async function celebrate_milestone(
  userId: string,
  milestoneType: string,
  details: any
) {
  // Log the milestone
  await db.query(`
    INSERT INTO milestones (user_id, type, details, celebrated_at)
    VALUES ($1, $2, $3, NOW())
  `, [userId, milestoneType, details]);

  // Generate celebration message
  const celebrations = {
    vocabulary_milestone: `🎉 Amazing! You've mastered ${details.count} words! That's ${details.percentile}th percentile among learners!`,
    streak: `🔥 Incredible ${details.days}-day streak! You're building a real habit!`,
    fluency_improvement: `📈 Your speaking speed improved by ${details.percent}%! You're getting so much more fluent!`,
    pronunciation_mastery: `🎯 Perfect pronunciation of "${details.word}"! Your hard work is paying off!`
  };

  return {
    message: celebrations[milestoneType] || 'Great job!',
    milestone_id: milestoneType,
    badge_earned: determineBadge(milestoneType, details)
  };
}
```

## Tool Reliability Best Practices

### 1. Error Handling
```typescript
async function executeToolWithRetry(toolName: string, params: any, maxRetries: number = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executeTool(toolName, params);
    } catch (error) {
      if (attempt === maxRetries) {
        // Log failure and return graceful fallback
        await logToolFailure(toolName, params, error);
        return {
          success: false,
          fallback: true,
          message: "I tried to look that up but had a technical issue. Let's continue our practice anyway."
        };
      }
      // Exponential backoff
      await sleep(100 * Math.pow(2, attempt));
    }
  }
}
```

### 2. Validation
```typescript
function validateToolCall(toolName: string, params: any): boolean {
  const schemas = {
    schedule_spaced_review: {
      items: (v) => Array.isArray(v) && v.length > 0,
      interval_days: (v) => [1, 7, 14, 28, 56].includes(v), // Research-backed intervals only
    },
    adjust_difficulty: {
      direction: (v) => ['easier', 'harder'].includes(v),
      reason: (v) => typeof v === 'string' && v.length > 10,
    }
  };

  const schema = schemas[toolName];
  if (!schema) return true; // No validation defined

  return Object.entries(schema).every(([key, validator]) =>
    validator(params[key])
  );
}
```

### 3. Logging & Monitoring
```typescript
async function executeToolWithTelemetry(toolName: string, params: any) {
  const startTime = Date.now();

  try {
    const result = await executeTool(toolName, params);
    const duration = Date.now() - startTime;

    // Log success
    await db.query(`
      INSERT INTO tool_execution_log (tool_name, duration_ms, success, user_id)
      VALUES ($1, $2, true, $3)
    `, [toolName, duration, params.userId]);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log failure
    await db.query(`
      INSERT INTO tool_execution_log (tool_name, duration_ms, success, error, user_id)
      VALUES ($1, $2, false, $3, $4)
    `, [toolName, duration, error.message, params.userId]);

    throw error;
  }
}
```

## Tool Usage Patterns

### Pattern 1: Assessment → Generation → Practice
```
User: "I want to practice cooking vocabulary"
↓
1. query_user_vocabulary(['chop', 'boil', 'fry', 'sauté', 'simmer'])
   → User knows: chop, boil, fry (mastery 8, 7, 9)
   → User learning: sauté (mastery 3)
   → User new: simmer (mastery 0)
↓
2. generate_practice_sentence(
     target_words: ['sauté', 'simmer'],
     difficulty: 'medium',
     topic: 'cooking'
   )
   → "First, sauté the onions until golden, then add the sauce and let it simmer for 20 minutes."
↓
3. [User practices pronunciation]
↓
4. assess_pronunciation('sauté', user_said)
↓
5. track_pronunciation_attempt('sauté', 'good', notes)
↓
6. schedule_spaced_review(['sauté', 'simmer'], interval_days: 7)
```

### Pattern 2: Stats → Encouragement → Goal Setting
```
User: "How am I doing?"
↓
1. get_learning_stats(timeframe: 'week', include_trends: true)
   → 120 minutes practiced, 15 words mastered, +50% vs last week
↓
2. celebrate_milestone('weekly_goal', { minutes: 120, goal: 100 })
↓
3. set_personalized_goal(goal_type: 'vocabulary', target: 50, timeframe: 'month')
```

---

**Next**: See `05-TECH-STACK.md` for Deepgram, Llama, and Azure integration details.
