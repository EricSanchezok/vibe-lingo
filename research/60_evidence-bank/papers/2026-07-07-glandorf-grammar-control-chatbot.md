# Grammar Control in Dialogue Response Generation for Language Learning Chatbots

## Metadata
- Type: paper
- Date captured: 2026-07-07
- Source URL: arXiv:2502.07544
- Authors: Dominik Glandorf, Peng Cui, Detmar Meurers, Mrinmaya Sachan
- Year: 2025
- Reliability: high
- Tags: sla, chatbot-learning, grammar, llm

## Why It Matters
Addresses a critical technical challenge for VibeLingo: how to control LLM output to target specific grammar points appropriate for the learner level.

## Key Claims
- LLM chatbots offer cheap conversation practice but are hard to control for linguistic forms.
- Grammar-controlled responses can be achieved via grounding in a pedagogical grammar skills repository.
- Strategically decoding Llama3 outperforms GPT-3.5 for grammar control.
- Grammar-controlled responses support grammar acquisition adapted to learner proficiency.

## Evidence / Details
- Comprehensive evaluation of prompting, fine-tuning, and decoding strategies.
- Grammar grounding via pedagogical repository of grammar skills.
- Simulation predicts grammar-controlled responses aid acquisition.
- Code available on GitHub.

## Implications for VibeLingo
- Technical feasibility: LLM output can be grammar-controlled without full fine-tuning.
- Supports the idea of proficiency-adapted agent responses.
- Important for making agent output comprehensible (i+1)
- Could be used to incidentally reinforce specific grammar structures during work conversations.

## Limitations
- Simulation-based evaluation, no human learner study.
- Focused on grammar only, not broader communication.
- Llama3-based; may differ with proprietary models.

## Follow-up Questions
- Would grammar control work in free-form work conversations (not structured practice)?
- How to decide which grammar points to target per user?
- Does grammar control affect perceived naturalness of conversation?
