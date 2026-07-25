# Design Preferences — 大鸡蛋's Personal Use Cases

> Captured: 2026-07-07
> Source: conversation with user (大鸡蛋)
> Status: living document, update as preferences evolve

## Core Vision

**Use the target language directly in everyday Agent conversations, with VibeLingo as the enabling bridge.**

The user does NOT want a separate "learning mode" or "lesson time." They want to LIVE in the target language during their normal Synergy sessions, and the plugin's job is to make that possible — by removing the friction points that make it too hard today.

## Primary Use Cases (Pain-Then-Relief)

### 1. Input Assistance (I want to write in the target language, but I get stuck)

**Scenario**: The user types a message to the Agent in their target language (e.g., English), but hits a wall — can't find the right word, can't structure the sentence, freezes mid-typing.

**What they need**:
- A way to signal "help me express this" without leaving the input flow
- The plugin/Agent analyzes what they're trying to say and suggests how to say it
- Works inline — not a separate translator window or tool

**Key insight**: The user WANTS to type in the target language. They're not asking for a translation shortcut — they want assistance to succeed at their own attempt.

### 2. Expression Polish (I wrote it, but it doesn't feel right)

**Scenario**: The user successfully wrote something in the target language, but senses it's awkward — wrong tone, unnatural phrasing, too formal, too casual, or just "off."

**What they need**:
- A way to ask "how do I make this sound better / more natural?"
- Suggestions that preserve their intended meaning while improving delivery
- Ideally, the polish shows WHY the change is better (learning moment)

**Key insight**: This is about confidence. The user already made the effort; they want validation + refinement, not replacement.

### 3. Comprehension Support (Agent replied, but I don't fully understand)

**Scenario**: The Agent responds in the target language (or even in the user's native language with complex terms), and the user doesn't fully grasp the message.

**What they need**:
- Quick translation or explanation of specific parts they didn't understand
- NOT full-translation-everything — just the gaps
- Ideally, preserves the target-language context so they stay immersed

**Key insight**: The user wants to stay in the target language as much as possible. Translation should be surgical, not wholesale.

## Design Principles (Derived from the Above)

### Principle 1: In-Flow, Not Side-Quest

Language support must happen INSIDE the conversation flow. Opening a separate tool, switching windows, or entering a "learning mode" breaks the vibe. The plugin should feel like a natural extension of the Agent conversation.

### Principle 2: User Leads, Plugin Supports

The user initiates the target-language attempt. The plugin doesn't jump in uninvited to correct or suggest. It's a safety net, not a tutor hovering over the shoulder.

This may evolve — perhaps lightweight proactive nudges become acceptable — but the default posture should be: the user tries first, the plugin helps when asked.

### Principle 3: Teach Through Use, Not Through Lessons

Every assistance moment (input help, polish, translation) should leave the user slightly better than before. Show the "why," not just the "what." But keep it lightweight — a brief note, not a grammar lecture.

### Principle 4: Persistence That Feeds Back

The plugin should remember:
- Words/phrases the user struggled with (for later review)
- Patterns of error (recurring grammar issues)
- Expressions the user polished (so they can revisit)

This data should feed into spaced repetition, review prompts, or progress tracking — but never feel like homework. Review should be as lightweight as the assistance itself.

## Concrete Interaction Patterns (How It Might Look)

### Pattern A: "Help me say this"

```
User (typing to Agent): I want to @vibe-lingo help: "我需要把这个函数的返回值改成异步的"
Plugin: Here's one way: "I need to make this function's return value asynchronous."
       Alternatively: "I need to convert the return type of this function to async."
```

### Pattern B: "Polish this"

```
User (typing to Agent): @vibe-lingo polish: "Can you making the code more faster?"
Plugin: Suggestion: "Can you make the code faster?"
       Note: "making" → "make" (after modal verb "can"), removed "more" (faster already means more fast)
```

### Pattern C: "What does this mean?"

```
Agent: The issue is a race condition caused by mutable shared state across async boundaries.
User (to plugin): @vibe-lingo explain: "race condition" and "mutable shared state"
Plugin: race condition = 竞态条件 (when two things compete and the result depends on timing)
       mutable shared state = 可变共享状态 (data that multiple parts of code can change)
```

## What This Means for Research

Given these preferences, our research should prioritize:

1. **SLA / corrective feedback**: What kind of correction actually sticks? Implicit vs explicit? Immediate vs delayed?
2. **Input assistance UX**: How do chat-based language tools handle mid-typing assistance? What patterns exist in Grammarly, LanguageTool, etc.?
3. **Comprehensible input + i+1**: The Agent's natural responses may already provide good input at the right level. How do we tune/enhance this?
4. **Vocabulary capture + spaced repetition**: How should the plugin capture "struggle moments" and schedule lightweight review?
5. **Minimal viable persistence**: What's the simplest useful thing to remember, and where does it live in Synergy (memory, notes, plugin data)?

## Open Questions

- Should the plugin have an explicit trigger (@vibe-lingo, /lingo) or detect intent from natural language?
- How should the user set their target language and proficiency level?
- Should comprehension help be available for the Agent's entire response, or only user-selected fragments?
- At what point does proactive suggestion (vs. user-initiated) become helpful rather than annoying?
