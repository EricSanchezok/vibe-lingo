import { expect, test } from "bun:test"
import {
  reviewActivityForCommand,
  reviewActivityLabel,
} from "../src/ui/review-activity"

test("describes each synchronous review phase instead of calling every wait data loading", () => {
  expect(reviewActivityLabel("zh-CN", "preparing_first")).toBe("正在为你准备第一道练习…")
  expect(reviewActivityLabel("zh-CN", "evaluating_response")).toBe("正在仔细看看你的表达…")
  expect(reviewActivityLabel("zh-CN", "preparing_next")).toBe("正在换一个新场景给你练习…")
  expect(reviewActivityLabel("zh-CN", "saving_progress")).toBe("正在记下这次进度…")
  expect(reviewActivityLabel("zh-CN", "resuming_review")).toBe("正在回到刚才的位置…")
  expect(reviewActivityLabel("zh-CN", "preparing_hint")).toBe("正在想一个恰到好处的提示…")
  expect(reviewActivityLabel("zh-CN", "finishing_review")).toBe("正在整理这次复习的结果…")

  expect(reviewActivityLabel("en", "preparing_first")).toBe("Getting your first exercise ready…")
  expect(reviewActivityLabel("en", "evaluating_response")).toBe("Taking a closer look at your expression…")
})

test("maps review commands to the work they actually perform", () => {
  expect(reviewActivityForCommand("submit_answer", false)).toBe("evaluating_response")
  expect(reviewActivityForCommand("next_item", true)).toBe("preparing_next")
  expect(reviewActivityForCommand("next_item", false)).toBe("finishing_review")
  expect(reviewActivityForCommand("request_hint", false)).toBe("preparing_hint")
  expect(reviewActivityForCommand("pause", false)).toBe("saving_progress")
  expect(reviewActivityForCommand("resume", false)).toBe("resuming_review")
  expect(reviewActivityForCommand("abandon", false)).toBe("finishing_review")
})
