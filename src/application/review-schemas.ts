import { z } from "zod"

function boundedText(maximumCodePoints: number) {
  return z.string().min(1).refine(
    (value) => Array.from(value).length <= maximumCodePoints,
    `Must contain at most ${maximumCodePoints} Unicode code points`,
  )
}

export const ReviewContentSchema = z.object({
  challenge: boundedText(500),
  hintOne: boundedText(160),
  hintTwo: boundedText(160),
  explanation: boundedText(300),
  referenceAnswer: boundedText(160),
  transferChallenge: boundedText(500),
  rubric: boundedText(300),
}).strict()

export const ReviewEvaluationSchema = z.object({
  verdict: z.enum(["incorrect", "partially_correct", "correct"]),
  feedback: boundedText(300),
  naturalAnswer: boundedText(160),
  confidence: z.number().min(0).max(1),
  sensitive: z.boolean(),
}).strict()
