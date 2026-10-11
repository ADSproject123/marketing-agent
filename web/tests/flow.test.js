import test from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_STATUSES, nodeStateMap, stageForJob } from "../src/flow.js";

test("a saved script awaits user review before the video stage", () => {
  const draft = { status: "script_review", title: "Reviewed campaign" };
  assert.equal(stageForJob(draft), "gemini");
  assert.equal(ACTIVE_STATUSES.has(draft.status), false);
  const states = nodeStateMap(draft);
  assert.equal(states.gemini, "current");
  assert.equal(states.notebooklm, "pending");
  assert.equal(states.telegram, "pending");
  assert.equal(states.approve, "idle");
});

test("a rendered video still requires Telegram approval before publishing", () => {
  const states = nodeStateMap({ status: "awaiting_approval", video_path: "finished.mp4", title: "Reviewed campaign" });
  assert.equal(states.notebooklm, "done");
  assert.equal(states.telegram, "current");
  assert.equal(states.approve, "pending");
  assert.equal(states.facebook, "idle");
});
