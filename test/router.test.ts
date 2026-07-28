import { describe, expect, test } from "bun:test"
import { parseDashboardRoute, routeParams } from "../src/ui/router"

describe("dashboard query routing", () => {
  test("parses every public view and keeps only valid identifiers", () => {
    expect(parseDashboardRoute("?view=overview")).toEqual({ view: "overview" })
    expect(parseDashboardRoute("?view=review&review=11111111-1111-4111-8111-111111111111"))
      .toEqual({ view: "review", reviewId: "11111111-1111-4111-8111-111111111111" })
    expect(parseDashboardRoute("?view=pattern&pattern=missing_article"))
      .toEqual({ view: "pattern", patternKey: "missing_article" })
    expect(parseDashboardRoute("?view=record&event=22222222-2222-4222-8222-222222222222"))
      .toEqual({ view: "record", eventId: "22222222-2222-4222-8222-222222222222" })
  })

  test("falls back to a recoverable parent view for malformed routes", () => {
    expect(parseDashboardRoute("?view=unknown")).toEqual({ view: "overview" })
    expect(parseDashboardRoute("?view=pattern&pattern=../../secret")).toEqual({ view: "patterns" })
    expect(parseDashboardRoute("?view=record&event=nope")).toEqual({ view: "journey" })
  })

  test("serializes only stable public route fields", () => {
    expect(routeParams({ view: "pattern", patternKey: "missing_article" })).toEqual({
      view: "pattern",
      pattern: "missing_article",
    })
  })
})
