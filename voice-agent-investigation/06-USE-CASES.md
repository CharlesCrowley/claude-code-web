# Use Cases: Real Conversation Scenarios

## Overview

This document shows how the agentic voice tutor operates in real scenarios, demonstrating:
- Memory retrieval and usage
- Tool calling decisions
- Pedagogical reasoning
- Personalization in action

## Use Case 1: Returning User with Pronunciation Struggle

### Context
- User: Maria, B1 level, native Spanish speaker
- Last session (3 days ago): Struggled with "th" sound in "thought", "through"
- Upcoming review: 12 words due today
- Personality: Gets frustrated easily, responds well to encouragement

### Conversation

**User**: "Hi! I'm ready to practice."

**Agent Internal Process**:
```
1. Memory Retrieval:
   - Episodic: "3 days ago, struggled with 'th' in thought/through, frustration detected"
   - Semantic: "B1 level, Spanish native, prefers 10-min sessions"
   - Learning: "12 words due for review today, pronunciation mastery avg: 6.8/10"

2. Tool Call: get_learning_stats(timeframe: "week")
   Result: { sessions: 4, minutes: 42, words_mastered: 8, trend: "improving" }

3. LLM Reasoning:
   - Maria has been consistent this week (+4 sessions)
   - She struggled with "th" last time → might still need work
   - 12 reviews due → should address but not overwhelming
   - Start encouraging, acknowledge her effort
```

**Agent**: "Hi Maria! Great to see you back! 🎉 You've been so consistent this week—4 sessions and 8 new words mastered. That's impressive! I remember you were working on the 'th' sound last time. How are you feeling about it now? Want to do a quick check, or would you rather jump into your vocabulary review? You have 12 words ready."

**User**: "Let's check my 'th' sound first. I've been practicing."

**Agent Internal Process**:
```
4. LLM Decision: Set up pronunciation practice
   - Create drill for "th" words
   - Use words she struggled with + new examples
   - Be encouraging (personality trait)

5. Tool Call: generate_practice_sentence(
     target_words: ["thought", "through", "thorough"],
     difficulty: "medium",
     topic: null
   )
   Result: "I thought this through thoroughly before deciding."
```

**Agent**: "Perfect! I love that you've been practicing. Let's try this sentence: 'I thought this through thoroughly before deciding.' It has three 'th' words. Give it your best shot, and remember—place your tongue between your teeth for that 'th' sound. Ready when you are!"

**User**: [Attempts pronunciation]
- STT hears: "I taught this through thoroughly before deciding"

**Agent Internal Process**:
```
6. Tool Call: assess_pronunciation(
     target_word: "thought",
     actual_transcription: "taught"
   )
   Result: {
     quality: "fair",
     phonetic_issues: [{
       phoneme: "th",
       problem: "Substituted with 't'",
       suggestion: "Place tongue between teeth, not behind"
     }]
   }

7. Tool Call: track_pronunciation_attempt(
     word: "thought",
     quality: "fair",
     notes: "th → t substitution, common for Spanish speakers"
   )

8. LLM Reasoning:
   - She improved from "poor" (3 days ago) to "fair" (today)
   - Should celebrate progress
   - Provide specific, actionable feedback
   - Offer one more attempt
```

**Agent**: "Good effort, Maria! I can hear you're getting closer. The 'th' in 'thought' came out more like a 't' sound. That's super common—I see this a lot. Here's the trick: put your tongue between your teeth, not behind them. Let's just practice 'thought' alone. Say it slowly with me: 'thhhh-ought.' Try it!"

**User**: [Better attempt]
- STT hears: "thought" (confidence: 0.87)

**Agent Internal Process**:
```
9. Tool Call: assess_pronunciation(
     target_word: "thought",
     actual_transcription: "thought",
     word_timings: [{ confidence: 0.87 }]
   )
   Result: { quality: "good", confidence: 0.87 }

10. Tool Call: track_pronunciation_attempt(word: "thought", quality: "good")

11. Tool Call: schedule_spaced_review(
      items: ["thought", "through", "thorough"],
      interval_days: 7
    )

12. Tool Call: celebrate_milestone(
      milestone_type: "pronunciation_improvement",
      details: { word: "thought", from: "fair", to: "good" }
    )
```

**Agent**: "YES! That was so much better! Did you feel the difference? Your 'th' is really coming together. I'm scheduling a review of these 'th' words for a week from now so you keep this progress. You're doing great! Now, should we move on to your vocabulary review, or want to practice a few more pronunciation words?"

---

## Use Case 2: New Concept Introduction with Adaptive Difficulty

### Context
- User: Jake, A2 level, learning for travel
- No recent sessions (5 days since last practice)
- Completed 4-3-2 fluency session last time (good improvement)

### Conversation

**User**: "I want to learn some words about restaurants. I'm traveling to Spain next month."

**Agent Internal Process**:
```
1. Memory Retrieval:
   - Semantic: "A2 level, motivation: travel to Spain, prefers conversational practice"
   - Learning: "Knows ~800 words, 4-3-2 fluency: 89 WPM"

2. Tool Call: query_user_vocabulary(words: [
     "menu", "waiter", "bill", "order", "recommend",
     "appetizer", "entree", "dessert", "reservation"
   ])
   Result: {
     known: ["menu", "waiter", "order"] (mastery 7-8),
     unknown: ["bill", "recommend", "appetizer", "entree", "dessert", "reservation"]
   }

3. LLM Reasoning:
   - Jake knows basic words but not restaurant-specific vocab
   - He's A2, so introduce 3-4 words max per session
   - Travel context = practical, conversational approach
   - He likes 4-3-2, so maybe do a role-play scenario
```

**Agent**: "Perfect timing, Jake! Spain is amazing—you're going to have such a great time with the food. I see you already know 'menu', 'waiter', and 'order', which is a great start. Let's add a few more essential ones: 'bill', 'recommend', and 'reservation'. These three will help you so much at restaurants. Want to learn them through a quick role-play?"

**User**: "Yes, role-play sounds good!"

**Agent Internal Process**:
```
4. Tool Call: generate_practice_sentence(
     target_words: ["bill", "recommend", "reservation"],
     difficulty: "easy",
     topic: "restaurant"
   )
   Result: [
     "Can you recommend a good dish?",
     "I'd like to make a reservation for two.",
     "Could I have the bill, please?"
   ]

5. LLM Decision: Create scaffolded practice
   - Teach one word at a time
   - Provide context and example
   - Have Jake repeat and use in his own sentence
```

**Agent**: "Great! Let's start with 'recommend'. This means to suggest something good. Like if I say, 'Can you recommend a good dish?'—I'm asking for a suggestion. Your turn: repeat after me—'Can you recommend a good dish?'"

**User**: [Repeats successfully]

**Agent Internal Process**:
```
6. Tool Call: log_vocabulary_practice(
     word: "recommend",
     quality: "good"
   )

7. Tool Call: schedule_spaced_review(
     items: ["recommend"],
     interval_days: 1  // First exposure, review tomorrow
   )
```

**Agent**: "Perfect! Now let's use it differently. Imagine you're at a restaurant in Barcelona. How would you ask the waiter to suggest a wine?"

**User**: "Can you recommend a good wine?"

**Agent Internal Process**:
```
8. Tool Call: track_vocabulary_usage(word: "recommend", context: "original_sentence")

9. LLM Reasoning:
   - Jake successfully used the word in a new context
   - He's ready for the next word
   - Keep energy high, this is going well
```

**Agent**: "Excellent! You're a natural. Okay, next word: 'reservation'. This is when you book a table ahead of time. In Spain, for popular restaurants, you'll definitely want to make a reservation. Try saying: 'I'd like to make a reservation for two.'"

**User**: [Repeats, but says "preservación" - Spanish cognate confusion]

**Agent Internal Process**:
```
10. Tool Call: assess_pronunciation(
      target_word: "reservation",
      actual_transcription: "preservación"
    )
    Result: { quality: "poor", issue: "cognate_confusion" }

11. LLM Reasoning:
    - Common cognate false friend (reservation ≠ preservación)
    - Jake is Spanish speaker (from profile), makes sense
    - Gently correct, explain the difference
    - Have him practice a few times
```

**Agent**: "Ah, I caught that! You said 'preservación', which is Spanish for preservation. In English, it's 'reservation' with a 'z' sound: rezer-VAY-shun. Let's try it slowly: reser-vation. Give it another go!"

**User**: [Corrects: "reservation"]

**Agent**: "Perfect! Much better. Let's do the last one: 'bill'. This is what you ask for when you're done eating and want to pay. 'Could I have the bill, please?' Easy one—try it!"

**User**: [Says correctly]

**Agent Internal Process**:
```
12. Tool Call: log_vocabulary_practice(
      words: ["reservation", "bill"],
      quality: "good"
    )

13. Tool Call: schedule_spaced_review(
      items: ["bill", "recommend", "reservation"],
      interval_days: 1
    )

14. Tool Call: update_learning_path(
      user_id: userId,
      next_topic: "restaurant_role_play",
      reason: "User practiced vocab, ready for application"
    )
```

**Agent**: "Amazing work today, Jake! You learned three super useful words: 'recommend', 'reservation', and 'bill'. Tomorrow, we'll review these and maybe do a full restaurant role-play where you're ordering dinner in Spain. Sound good? You're going to be so ready for your trip!"

---

## Use Case 3: Detecting Frustration and Adjusting

### Context
- User: Yuki, B2 level, preparing for job interview
- Current session: Practicing formal business vocabulary
- Difficulty level: 7/10

### Conversation

**User**: "Let's keep going with the business words."

**Agent**: "Great! Let's practice 'collaborate'. Can you use it in a sentence about your work experience?"

**User**: "Um... I... collaborate with my team on... um... projects."

**Agent Internal Process**:
```
1. Analysis:
   - High filler word count: 2 "um"s in short sentence
   - Low confidence (detected from hesitation)
   - Word timings show long pauses

2. Memory check:
   - This is the 4th struggle in this session
   - Yuki's frustration_count has been increasing

3. LLM Reasoning:
   - Difficulty might be too high
   - Yuki is preparing for interview → pressure is high
   - Should check in emotionally and possibly adjust difficulty
```

**Agent**: "Good sentence, Yuki. I noticed you're hesitating a bit more than usual today. How are you feeling? Is this pace working for you, or should we slow down a little?"

**User**: "I'm feeling stressed. The interview is in two days and I feel like I don't know enough."

**Agent Internal Process**:
```
4. Emotion Detection: "stressed", "don't know enough" = anxiety, low confidence

5. Tool Call: get_learning_stats(timeframe: "week", include_trends: true)
   Result: {
     words_mastered: 42,
     interview_practice_sessions: 6,
     confidence_trend: "improving"
   }

6. LLM Reasoning:
   - Yuki is catastrophizing (common pre-interview)
   - Need reassurance + evidence of progress
   - Shift from "learning new" to "reinforcing known"
   - Reduce difficulty temporarily

7. Tool Call: adjust_difficulty(
     direction: "easier",
     reason: "User experiencing pre-interview anxiety, shift to confidence-building",
     amount: 2
   )
```

**Agent**: "Hey, Yuki, take a breath. Let me show you something real quick. This week alone, you've mastered 42 business words and done 6 interview practice sessions. That's incredible progress. You know way more than you think. Let's shift gears—instead of learning new words, let's practice what you already know really well. That'll build your confidence. Sound good?"

**User**: "Okay... yeah, that sounds better."

**Agent Internal Process**:
```
8. Tool Call: query_user_vocabulary(get_similar: false)
   Result: { mastered_words: 156, high_mastery: 89 words (mastery >= 8) }

9. Tool Call: generate_practice_scenario(
     type: "interview_question",
     use_known_vocab: true,
     difficulty: "medium"
   )
```

**Agent**: "Perfect. Let's do a quick mock interview question with words you know well. Here's the question: 'Tell me about a time you worked on a challenging project.' You've got this, Yuki. Use the words you know, and just speak naturally. I'm listening."

**User**: [Gives answer with more confidence]

**Agent Internal Process**:
```
10. Analysis:
    - Much lower filler word count
    - Longer utterance without hesitation
    - Used "collaborate", "deadline", "achieve" correctly

11. Tool Call: celebrate_milestone(
      milestone_type: "confidence_recovery",
      details: { session: "pre-interview_prep" }
    )
```

**Agent**: "THAT was fantastic, Yuki! See how much you know? You used 'collaborate', 'deadline', and 'achieve' perfectly, and you sounded confident. The interviewer is going to love you. You're ready. Let's do two more practice questions just like this, and you'll go into that interview feeling strong."

---

## Use Case 4: Proactive Intervention (Agent Initiates)

### Context
- User: Carlos, A1 level, 14-day streak
- Scheduled review: 8 words due today (from 7 days ago)
- User logs in but says nothing

### Conversation

**User**: [Logs in, silent]

**Agent Internal Process**:
```
1. Session Start Trigger:
   - User is logged in
   - Scheduled review exists
   - User hasn't spoken (10 seconds elapsed)

2. Tool Call: get_learning_stats(timeframe: "all_time")
   Result: { current_streak: 14, longest_streak: 14, total_sessions: 18 }

3. Tool Call: check_scheduled_reviews()
   Result: {
     due_today: ["achieve", "benefit", "consider", "develop", "establish", "identify", "improve", "require"],
     last_reviewed: 7 days ago
   }

4. LLM Reasoning:
   - Carlos is on his longest streak! Celebrate this.
   - He has reviews due (spaced repetition schedule)
   - A1 level = keep encouragement high
   - Proactively suggest the review session
```

**Agent**: "Hey Carlos! Wow, 14 days in a row—that's your longest streak ever! You're building an amazing habit. I have 8 words ready for your review today. These are the words you learned a week ago. Want to go through them quickly? Should only take about 5 minutes."

**User**: "Sure, let's do it."

**Agent Internal Process**:
```
5. Tool Call: start_spaced_review_session(
     review_id: scheduled_review_id
   )

6. LLM Decision: Review format
   - A1 level → simple, one-at-a-time
   - Mix recall (say definition) and production (use in sentence)
   - Celebrate every success (A1 needs lots of encouragement)
```

**Agent**: "Awesome! First word: 'achieve'. Do you remember what it means?"

**User**: "Um... to get something you worked for?"

**Agent Internal Process**:
```
7. Tool Call: assess_vocabulary_recall(
     word: "achieve",
     user_response: "to get something you worked for",
     expected: "to successfully reach a goal"
   )
   Result: { quality: "good", similarity: 0.89 }

8. Tool Call: update_vocabulary_mastery(
     word: "achieve",
     performance: "good"
   )
   → Mastery increased to 8/10
   → Next review scheduled for 14 days

9. Tool Call: schedule_spaced_review(
     items: ["achieve"],
     interval_days: 14
   )
```

**Agent**: "Yes! Exactly right. 'Achieve' means to get something you worked for—like achieving your goal of learning English. Great memory! Now use it in a sentence about yourself."

**User**: "I want to achieve fluency in English."

**Agent**: "Perfect sentence, Carlos! That's exactly how you use it. Okay, next: 'benefit'. What does benefit mean?"

[Process continues for all 8 words]

**Agent Internal Process (After Review)**:
```
10. Results:
    - 8/8 words recalled correctly
    - Average mastery increased from 6.2 → 7.8
    - All words rescheduled with 14-day interval

11. Tool Call: celebrate_milestone(
      milestone_type: "perfect_review",
      details: { words: 8, accuracy: 100 }
    )

12. Tool Call: get_learning_stats(timeframe: "all_time")
    Result: { total_words_mastered: 34 (mastery >= 7) }
```

**Agent**: "Carlos, you just went 8 for 8! Perfect review! 🎉 You now have 34 words mastered. That's incredible for just 18 sessions. Your consistency is paying off big time. I'll see you tomorrow to keep the streak going. You're crushing this!"

---

## Use Case 5: Cross-Session Coherence (Long-Term Memory)

### Context
- User: Emma, C1 level, learning for academic purposes
- 3 months of sessions
- Long-term goal: Present research at conference in 6 months
- Previous mention of "imposter syndrome" 4 weeks ago

### Conversation

**User**: "I'm preparing my conference presentation. Can we practice?"

**Agent Internal Process**:
```
1. Memory Retrieval:
   - Episodic (relevant): "4 weeks ago, Emma expressed anxiety about presenting, mentioned 'imposter syndrome'"
   - Semantic: "C1 level, academic context, goal: conference in 6 months"
   - Learning: "Has practiced academic vocabulary 12 times, presentation skills 3 times"

2. Tool Call: get_learning_stats(timeframe: "month")
   Result: {
     presentation_practice: 3 sessions,
     academic_vocab_mastered: 67 words,
     confidence_metrics: improving
   }

3. LLM Reasoning:
   - Emma has made progress since expressing imposter syndrome
   - Should acknowledge her progress and past concerns (shows I "remember")
   - C1 level = can handle complex feedback
   - Presentation = high stakes, need supportive but honest feedback
```

**Agent**: "Absolutely, Emma! I remember you mentioned feeling some imposter syndrome about this presentation a few weeks ago. Looking at your progress, you've practiced presentations 3 times this month and mastered 67 academic vocabulary words. You're way more prepared than you think. What part of the presentation do you want to practice?"

**User**: "Wow, you remembered that. Thanks. I want to practice my introduction—I feel like I ramble."

**Agent Internal Process**:
```
4. LLM Decision:
   - Practice introduction, focus on conciseness
   - C1 level → can handle detailed feedback
   - Use presentation best practices (hook, roadmap, credibility)

5. Tool Call: create_presentation_framework(
     type: "academic_introduction",
     level: "C1"
   )
   Result: {
     structure: "Hook → Problem → Your approach → Roadmap",
     time_limit: "60-90 seconds"
   }
```

**Agent**: "Good self-awareness. Let's tighten it up. Academic introductions work best with this structure: Hook → Problem → Your approach → Roadmap. All in 60-90 seconds. Give me your current version, and then we'll refine it together."

**User**: [Gives 2-minute rambling introduction]

**Agent Internal Process**:
```
6. Analysis:
   - Duration: 127 seconds (too long)
   - Filler words: 8
   - Structural issues: Buried the problem, no clear roadmap
   - Vocabulary: Excellent (C1 level appropriate)
   - Pronunciation: Clear

7. LLM Reasoning:
   - Emma needs structural feedback, not vocabulary
   - Be honest but supportive (she can handle it at C1)
   - Offer specific restructuring advice
```

**Agent**: "Okay, your vocabulary and pronunciation are excellent—very polished. The issue is structure, not language. You spent 40 seconds on background before getting to your actual research problem. Let's flip it: Lead with your research question, THEN give just enough context. Try this: One sentence hook, one sentence problem, one sentence your approach, one sentence roadmap. That'll get you under 90 seconds and way more punchy. Want to try a restructured version?"

**User**: [Gives tighter version, 85 seconds]

**Agent Internal Process**:
```
8. Tool Call: assess_presentation(
     type: "introduction",
     duration: 85,
     structure_score: 9,
     delivery_score: 8,
     improvements: ["Much tighter", "Clear roadmap", "Strong hook"]
   )

9. Tool Call: track_presentation_progress(
     session_type: "introduction_practice",
     before_duration: 127,
     after_duration: 85,
     improvement_percent: 33
   )

10. Tool Call: schedule_spaced_review(
      items: ["presentation_introduction_v2"],
      interval_days: 7,
      type: "presentation_practice"
    )
```

**Agent**: "YES! That was so much better, Emma. You cut 42 seconds and it's way clearer. Your hook was strong, your problem was obvious, and I could follow your roadmap perfectly. That's conference-ready. Let's practice this exact version again in a week so it becomes automatic. You're going to nail this presentation. The imposter syndrome is lying to you—you're absolutely qualified to be there."

---

## Common Patterns Across Use Cases

### 1. Memory Contextualizes Everything
- Agent remembers past struggles (Maria's "th" sound)
- Agent recalls user's motivations (Jake's Spain trip)
- Agent references emotional moments (Yuki's stress, Emma's imposter syndrome)

### 2. Tools Enable Action
- Not just conversation—actual intervention
- Schedule reviews, track progress, adjust difficulty
- Generate personalized content on-the-fly

### 3. Pedagogical Intelligence
- Adapts to user's level (A1: simple, C1: complex feedback)
- Detects frustration and adjusts (Yuki case)
- Uses research-backed methods (spaced repetition, 4-3-2)

### 4. Proactive Guidance
- Initiates helpful actions (Carlos's review)
- Suggests next steps
- Celebrates milestones unprompted

### 5. Emotional Intelligence
- Encouragement when needed (Maria, Carlos)
- Reassurance under pressure (Yuki)
- Honest but supportive feedback (Emma)

---

**Next**: See `07-ROADMAP.md` for phased implementation plan.
