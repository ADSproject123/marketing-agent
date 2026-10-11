export function storyboardDuration(storyboard) {
  return (storyboard?.scenes || []).reduce((total, scene) => total + (Number(scene.duration_seconds) || 0), 0);
}

const HOOK_ARCHETYPES = ["pain_agitation", "curiosity_intrigue", "value_offer"];

export function narrationUnitCount(text, language = "en") {
  const cleaned = (text || "").trim();
  if (!cleaned) return 0;
  if (language === "km") return Math.max(1, Math.floor(cleaned.length / 3));
  return cleaned.split(/\s+/).filter(Boolean).length;
}

export function maxNarrationUnits(durationSeconds, language = "en") {
  const rate = language === "km" ? 3.8 : 2.4;
  return Math.max(1, Math.ceil(Number(durationSeconds) * rate - 1e-9));
}

/** Lengthen overcrowded scenes so natural speech pacing fits (matches API). */
export function fitStoryboardSpeechCadence(storyboard) {
  if (!storyboard?.scenes?.length) return storyboard;
  const language = storyboard.language === "km" ? "km" : "en";
  const rate = language === "km" ? 3.8 : 2.4;
  let changed = false;
  const scenes = storyboard.scenes.map((scene, index) => {
    const duration = Number(scene.duration_seconds) || 0;
    const units = narrationUnitCount(scene.narration, language);
    if (!units || !Number.isFinite(duration) || units <= maxNarrationUnits(duration, language)) {
      return scene;
    }
    const needed = Math.ceil((units / rate) * 10) / 10;
    const lo = index === 0 ? 2 : 1;
    const hi = index === 0 ? 5 : 20;
    const next = Math.min(hi, Math.max(lo, Math.max(duration, needed)));
    if (Math.abs(next - duration) < 0.05) return scene;
    changed = true;
    return { ...scene, duration_seconds: next };
  });
  return changed ? { ...storyboard, scenes } : storyboard;
}

export function selectStoryboardHook(storyboard, hookId) {
  const hook = storyboard.hooks.find((item) => item.id === hookId);
  if (!hook) return storyboard;
  return {
    ...storyboard,
    selected_hook: hookId,
    scenes: storyboard.scenes.map((scene, index) => index === 0 ? { ...scene, narration: hook.text, ...(scene.on_screen_text === scene.narration ? { on_screen_text: hook.text } : {}) } : scene),
  };
}

export function updateStoryboardHook(storyboard, hookId, text) {
  return {
    ...storyboard,
    hooks: storyboard.hooks.map((hook) => hook.id === hookId ? { ...hook, text } : hook),
    scenes: storyboard.scenes.map((scene, index) => index === 0 && hookId === storyboard.selected_hook ? { ...scene, narration: text, ...(scene.on_screen_text === scene.narration ? { on_screen_text: text } : {}) } : scene),
  };
}

export function updateStoryboardScene(storyboard, sceneId, field, value) {
  const index = storyboard.scenes.findIndex((scene) => scene.id === sceneId);
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene) => scene.id === sceneId ? { ...scene, [field]: value, ...(field === "narration" && index === 0 && scene.on_screen_text === scene.narration ? { on_screen_text: value } : {}) } : scene),
    hooks: field === "narration" && index === 0
      ? storyboard.hooks.map((hook) => hook.id === storyboard.selected_hook ? { ...hook, text: value } : hook)
      : storyboard.hooks,
  };
}

export function validateStoryboard(storyboard) {
  const errors = {};
  if (!storyboard) return { storyboard: "Load a script before continuing." };
  if (!storyboard.title?.trim()) errors.title = "Add a campaign title.";
  if (!storyboard.caption?.trim()) errors.caption = "Add a social caption.";
  for (const [field, max] of Object.entries({ title: 60, caption: 1000, business_name: 120, offer: 700, contact: 1000 })) {
    if ((storyboard[field] || "").length > max) errors[field] = `Keep this under ${max} characters.`;
  }
  const language = storyboard.language === "km" ? "km" : "en";
  if (!Array.isArray(storyboard.hooks) || storyboard.hooks.length !== 3) {
    errors.hooks = "Your script needs three opening choices.";
  } else {
    const archetypes = [];
    for (const [index, hook] of storyboard.hooks.entries()) {
      if (!hook.text?.trim()) errors[`hook-${hook.id}`] = "Add text for this opening.";
      if ((hook.text || "").length > 180) errors[`hook-${hook.id}`] = "Keep this opening under 180 characters.";
      const archetype = hook.archetype || HOOK_ARCHETYPES[index];
      if (!HOOK_ARCHETYPES.includes(archetype)) {
        errors[`hook-${hook.id}`] = "Choose a valid hook style.";
      } else {
        archetypes.push(archetype);
      }
    }
    if (archetypes.length === 3 && new Set(archetypes).size !== 3) {
      errors.hooks = "Use three different hook styles: pain, curiosity, and value.";
    }
    if (!storyboard.hooks.some((hook) => hook.id === storyboard.selected_hook)) errors.selected_hook = "Choose an opening.";
  }
  const scenes = storyboard.scenes || [];
  if (scenes.length < 3 || scenes.length > 8) errors.scenes = "Use between three and eight scenes.";
  scenes.forEach((scene, index) => {
    const seconds = Number(scene.duration_seconds);
    if (!Number.isFinite(seconds) || seconds < 1 || seconds > 20 || (index === 0 && (seconds < 2 || seconds > 5))) {
      errors[`scene-${scene.id}-duration_seconds`] = index === 0 ? "Keep your opening between 2 and 5 seconds." : "Use a duration between 1 and 20 seconds.";
    }
    if (!scene.narration?.trim()) errors[`scene-${scene.id}-narration`] = "Add the words to say in this scene.";
    if (!scene.visual_direction?.trim()) errors[`scene-${scene.id}-visual_direction`] = "Describe what viewers should see.";
    for (const [field, max] of Object.entries({ narration: 600, on_screen_text: 300, visual_direction: 600 })) {
      if ((scene[field] || "").length > max) errors[`scene-${scene.id}-${field}`] = `Keep this under ${max} characters.`;
    }
    if (scene.narration?.trim() && Number.isFinite(seconds) && seconds > 0) {
      const units = narrationUnitCount(scene.narration, language);
      const maxDuration = index === 0 ? 5 : 20;
      const allowedAtMax = maxNarrationUnits(maxDuration, language);
      // Only block when the line can't fit even at the longest allowed scene.
      if (units > allowedAtMax) {
        errors[`scene-${scene.id}-narration`] =
          `Scene ${index + 1} is too long to say naturally — trim it to about ${allowedAtMax} words or fewer.`;
      }
    }
  });
  const duration = storyboardDuration(storyboard);
  if (duration < 10 || duration > 60) errors.duration = "Keep the full video between 10 and 60 seconds.";
  const bgm = storyboard.bgm_track || "none";
  const allowedBgm = ["none", "upbeat_commercial", "cozy_lofi", "energetic_trend", "acoustic_warmth"];
  if (!allowedBgm.includes(bgm)) errors.bgm_track = "Choose a background music track.";
  const volume = Number(storyboard.bgm_volume ?? 0.22);
  if (bgm !== "none" && (!Number.isFinite(volume) || volume < 0.05 || volume > 0.5)) {
    errors.bgm_volume = "Keep music volume between 5% and 50%.";
  }
  return errors;
}

export function storyboardPayload(storyboard) {
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((scene) => ({ ...scene, duration_seconds: Number(scene.duration_seconds), asset_id: scene.asset_id || null })),
  };
}
