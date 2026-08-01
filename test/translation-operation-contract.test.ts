import { describe, expect, test } from "bun:test"
import { schemaToJsonSchema } from "@ericsanchezok/synergy-plugin"
import plugin from "../src"

describe("translation operation contract", () => {
  test("accepts the selection-only payload supplied by text actions", () => {
    const operation = plugin.contributions.find(
      (candidate) => candidate.kind === "operation" && candidate.id === "translate-selection",
    )
    if (!operation || operation.kind !== "operation") {
      throw new Error("translate-selection operation is missing")
    }

    expect(schemaToJsonSchema(operation.input)).toMatchObject({
      required: ["selection"],
      properties: {
        destination: { default: "adaptive" },
        bypassCache: { default: false },
      },
    })
  })
})
