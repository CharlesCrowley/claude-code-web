# Language Learning Experimentation Platform

A repository for experimenting with various language learning features and research-backed approaches to ESL/language acquisition.

## Tech Stack

- **Frontend:** Vite + React + TypeScript
- **Routing:** Wouter (lightweight React router)
- **Backend:** Node.js + TypeScript
- **Database:** Neon (serverless PostgreSQL)

## Features

### Fluency Gym

An experimental feature for pronunciation and fluency practice based on spaced repetition research:

- **Initial Training:** 7 days of intensive daily practice
  - Listen 3x to native pronunciation
  - Repeat 5x for practice
  - Simple comprehension exercises

- **Spaced Review Schedule:** Research-backed intervals for long-term retention
  - First review: 7-10 days after intensive week (configurable)
  - Exponential expansion: 2x multiplier (e.g., 7→14→28→56 days)
  - Based on spacing effect and distributed practice research

## Research Foundation

This project is informed by extensive research on optimal practice frequency for language acquisition. See [SKILL.md](./SKILL.md) for comprehensive research findings including:

- Spacing effect meta-analysis (48 studies, N=3,411)
- Bahrick & Phelps 8-year retention study
- Optimal review interval timing (10-30% rule)
- Comparison of massed vs. spaced practice
- First review interval options after intensive training
- SuperMemo SM-2 algorithm and Fibonacci-like expansion schedules

### Key Research Insights

**"Longer is Safer Than Shorter"**
- Overshooting optimal spacing intervals is safer than undershooting
- Weekly practice (7-day intervals) maintains fluency gains as effectively as daily practice after initial intensive training
- 30-day maintenance intervals enhance multi-year retention

**Recommended Schedule Post-Intensive Week:**
- Conservative: 4 → 8 → 16 → 32 days
- Recommended: 7 → 14 → 28 → 56 days ⭐
- Aggressive: 10 → 20 → 40 → 80 days

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Goals

This repository serves as an experimental playground for:
- Testing research-backed language learning techniques
- Implementing spaced repetition systems for fluency development
- Exploring optimal practice schedules for pronunciation and comprehension
- Validating cognitive science principles in real-world applications

## Contributing

This is an experimental repository. Contributions welcome as we explore what works best for language learners.

## References

See [SKILL.md](./SKILL.md) for complete academic references and research findings.
