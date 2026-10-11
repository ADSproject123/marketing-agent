export function storyboardDuration(storyboard) {
  return (storyboard?.scenes || []).reduce((total, scene) => total + (Number(scene.duration_seconds) || 0), 0);
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
  if (!Array.isArray(storyboard.hooks) || storyboard.hooks.length !== 3) {
    errors.hooks = "Your script needs three opening choices.";
  } else {
    for (const hook of storyboard.hooks) {
      if (!hook.text?.trim()) errors[`hook-${hook.id}`] = "Add text for this opening.";
      if ((hook.text || "").length > 300) errors[`hook-${hook.id}`] = "Keep this opening under 300 characters.";
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
