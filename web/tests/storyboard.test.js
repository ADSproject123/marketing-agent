import assert from "node:assert/strict";
import test from "node:test";
import { selectStoryboardHook, storyboardDuration, storyboardPayload, updateStoryboardHook, updateStoryboardScene, validateStoryboard } from "../src/storyboard.js";

function plan() {
  return {
    language: "km", title: "Lotus Coffee", caption: "Visit us in Phnom Penh.", business_name: "Lotus Coffee", contact: "Phnom Penh", offer: "",
    hooks: [{ id: "h1", text: "Opening one" }, { id: "h2", text: "Opening two" }, { id: "h3", text: "Opening three" }], selected_hook: "h1",
    scenes: [
      { id: "s1", duration_seconds: 3, narration: "Opening one", on_screen_text: "Opening one", visual_direction: "Show the shop", asset_id: "0" },
      { id: "s2", duration_seconds: 9, narration: "Coffee roasted every morning.", on_screen_text: "Fresh coffee", visual_direction: "Show coffee preparation", asset_id: null },
      { id: "s3", duration_seconds: 4, narration: "Visit us in Phnom Penh.", on_screen_text: "Phnom Penh", visual_direction: "Show the shop sign", asset_id: null },
    ],
  };
}

test("choosing a hook updates the spoken opening and matching screen text without changing facts or later scenes", () => {
  const original = plan();
  const selected = selectStoryboardHook(original, "h2");
  assert.equal(selected.selected_hook, "h2");
  assert.equal(selected.scenes[0].narration, "Opening two");
  assert.equal(selected.scenes[0].on_screen_text, "Opening two");
  assert.equal(selected.scenes[0].asset_id, "0");
  assert.deepEqual(selected.scenes.slice(1), original.scenes.slice(1));
  assert.equal(selected.business_name, original.business_name);
  assert.equal(original.scenes[0].narration, "Opening one");
});

test("custom opening screen text survives hook changes and selected opening edits stay synchronized", () => {
  const original = plan();
  original.scenes[0].on_screen_text = "Lotus Coffee";
  const selected = selectStoryboardHook(original, "h3");
  const edited = updateStoryboardHook(selected, "h3", "A fresh opening");
  assert.equal(edited.scenes[0].narration, "A fresh opening");
  assert.equal(edited.scenes[0].on_screen_text, "Lotus Coffee");
  const sceneEdited = updateStoryboardScene(edited, "s1", "narration", "Another opening");
  assert.equal(sceneEdited.hooks[2].text, "Another opening");
  const inactiveEdited = updateStoryboardHook(sceneEdited, "h1", "Alternative");
  assert.equal(inactiveEdited.scenes[0].narration, "Another opening");
});

test("validation catches empty narration, invalid hooks and duration constraints before rendering", () => {
  assert.deepEqual(validateStoryboard(plan()), {});
  const invalid = plan();
  invalid.selected_hook = "missing";
  invalid.scenes[0].duration_seconds = 1;
  invalid.scenes[1].narration = " ";
  assert.ok(validateStoryboard(invalid).selected_hook);
  assert.ok(validateStoryboard(invalid)["scene-s1-duration_seconds"]);
  assert.ok(validateStoryboard(invalid)["scene-s2-narration"]);
  invalid.scenes.forEach((scene) => { scene.duration_seconds = 20; });
  invalid.scenes.push({ ...invalid.scenes[1], id: "s4" });
  assert.ok(validateStoryboard(invalid).duration);
  const short = plan();
  short.scenes.forEach((scene) => { scene.duration_seconds = 2; });
  assert.ok(validateStoryboard(short).duration);
});

test("payload normalizes decimal timings and keeps ordinal asset zero while optional facts may be empty", () => {
  const original = plan();
  original.contact = "";
  original.scenes[1].duration_seconds = "8.5";
  original.scenes[2].asset_id = "";
  const payload = storyboardPayload(original);
  assert.equal(payload.scenes[1].duration_seconds, 8.5);
  assert.equal(payload.scenes[0].asset_id, "0");
  assert.equal(payload.scenes[2].asset_id, null);
  assert.equal(storyboardDuration(payload), 15.5);
  assert.deepEqual(validateStoryboard(payload), {});
});
