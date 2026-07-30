import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs"
import os from "os"
import path from "path"
import { progressTool, renderProgress } from "../src/progress"
import { createServices } from "../src/application/services"
import { VibeLingoDatabase } from "../src/infrastructure/database"
import { LearningRepository } from "../src/infrastructure/learning-repository"
import { invocationContext, seedCorrection } from "./helpers"

const temporaryDirectories: string[] = []

function store(): LearningRepository {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "vibe-lingo-progress-"))
  temporaryDirectories.push(directory)
  return new LearningRepository(new VibeLingoDatabase(path.join(directory, "vibe-lingo.sqlite")))
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

describe("progress output", () => {
  test("renders evidence-backed counts and optional provenance without proficiency claims", () => {
    const output = renderProgress(
      {
        targetLanguage: "en",
        summary: {
          analyzedMessages: 12,
          analyzedMessagesToday: 3,
          findingsLast30Days: 4,
          targetAttemptsToday: 2,
          targetSessionsToday: 1,
          findingMessagesToday: 1,
          findingsToday: 1,
          correctionsToday: 1,
          acceptedFindingsToday: 1,
          correctionsAnalyzing: 0,
          correctionsFailed: 0,
          totalPatternCount: 1,
          recurringPatternCount: 1,
          candidatePatternCount: 0,
          practicingPatternCount: 1,
          targetAttempts: 10,
          activeDays: 3,
          sessionCount: 2,
          duePatternCount: 1,
          reviewCount: 0,
          reviewRecallCountLast30Days: 0,
          independentRecallCountLast30Days: 0,
          successfulTransferCountLast30Days: 0,
          successfulTransferSessionCountLast30Days: 0,
          awaitingVerificationCount: 0,
          verifiedPatternCount: 0,
          currentStreakDays: 2,
          learningWeek: 1,
          trends: { "7": [], "30": [], "90": [] },
        },
        patterns: [
          {
            patternKey: "missing_article",
            category: "grammar",
            label: "Missing article",
            rule: "Use a or the for one countable thing.",
            occurrenceCount: 4,
            sessionCount: 2,
            firstSeenAt: Date.UTC(2026, 0, 1),
            lastSeenAt: Date.UTC(2026, 0, 3),
            severity: "high_value",
            stage: "practicing",
            disposition: "active",
            displayStatus: "focus",
            scheduleStep: 0,
            lapseCount: 0,
            naturalCorrectCount: 1,
            independentReviewCount: 0,
            examples: [
              {
                observedAt: Date.UTC(2026, 0, 3),
                scopeId: "scope-a",
                sessionId: "session-a",
                messageId: "message-a",
                originalFragment: "add button",
                correctedFragment: "add a button",
              },
            ],
          },
        ],
      },
      true,
    )
    expect(output).toContain("Target-language attempts: 10")
    expect(output).toContain("4 error evidence item(s) across 2 session(s)")
    expect(output).toContain("`add button` → `add a button`")
    expect(output).toContain("session `session-a`")
    expect(output).not.toContain("proficiency")
    expect(output).not.toContain("mastered")
  })

  test("keeps stored fragments inside a single safe Markdown line", () => {
    const output = renderProgress(
      {
        targetLanguage: "en",
        summary: {
          analyzedMessages: 1,
          analyzedMessagesToday: 1,
          findingsLast30Days: 1,
          targetAttemptsToday: 1,
          targetSessionsToday: 1,
          findingMessagesToday: 1,
          findingsToday: 1,
          correctionsToday: 1,
          acceptedFindingsToday: 1,
          correctionsAnalyzing: 0,
          correctionsFailed: 0,
          totalPatternCount: 1,
          recurringPatternCount: 0,
          candidatePatternCount: 1,
          practicingPatternCount: 0,
          targetAttempts: 1,
          activeDays: 1,
          sessionCount: 1,
          duePatternCount: 0,
          reviewCount: 0,
          reviewRecallCountLast30Days: 0,
          independentRecallCountLast30Days: 0,
          successfulTransferCountLast30Days: 0,
          successfulTransferSessionCountLast30Days: 0,
          awaitingVerificationCount: 0,
          verifiedPatternCount: 0,
          currentStreakDays: 1,
          learningWeek: 1,
          trends: { "7": [], "30": [], "90": [] },
        },
        patterns: [
          {
            patternKey: "word_choice",
            category: "word_choice",
            label: "Word choice",
            rule: "Prefer the more precise word.",
            occurrenceCount: 1,
            sessionCount: 1,
            firstSeenAt: 1,
            lastSeenAt: 1,
            severity: "minor",
            stage: "candidate",
            disposition: "active",
            displayStatus: "new",
            scheduleStep: 0,
            lapseCount: 0,
            naturalCorrectCount: 0,
            independentReviewCount: 0,
            examples: [
              {
                observedAt: 1,
                scopeId: "scope",
                sessionId: "session",
                messageId: "message",
                originalFragment: "one\n`two`",
                correctedFragment: "one two",
              },
            ],
          },
        ],
      },
      true,
    )
    expect(output).toContain("`one ˋtwoˋ` → `one two`")
  })

  test("requires setup and defaults queries to the active target language", async () => {
    const database = store()
    const unconfigured = await progressTool(
      {},
      invocationContext({
        settings: {
          async get() {
            return {}
          },
        },
      }),
      database,
    )
    expect(unconfigured.metadata).toMatchObject({ setupRequired: true })

    const service = createServices(database.database)
    seedCorrection(
      service,
      {
        messageId: "message-es",
        scopeId: "scope-test",
        sessionId: "session-test",
        observedAt: Date.now(),
      },
      {
        nativeLanguage: "en",
        targetLanguage: "es",
        proficiency: "intermediate",
      },
      {
          patternKey: "missing_article",
          category: "grammar",
          severity: "high_value",
          label: "Missing article",
          rule: "Use an article with a singular countable noun.",
          originalFragment: "añade botón",
          correctedFragment: "añade un botón",
          confidence: 0.95,
          sensitive: false,
      },
    )
    const configured = await progressTool(
      {},
      invocationContext({
        settings: {
          async get() {
            return {
              nativeLanguage: "en",
              targetLanguage: "es",
              proficiency: "intermediate",
              correctionMode: "focused",
              trackingEnabled: true,
              recurringFocusEnabled: true,
            }
          },
        },
      }),
      database,
    )
    expect(configured.title).toContain("Spanish")
    expect(configured.metadata).toMatchObject({
      language: "es",
      targetAttempts: 1,
      analyzedMessagesToday: 1,
      targetAttemptsToday: 1,
      targetSessionsToday: 1,
      findingMessagesToday: 1,
      findingsToday: 1,
    })
  })
})
