export const STEPS = {
  system: {
    title: "System",
    subtitle: "Campaign details",
    detail: "Your business, audience, offer, and video direction become the campaign brief.",
  },
  gemini: {
    title: "Gemini",
    subtitle: "Review script",
    detail:
      "Creates three hooks and a scene plan for your review in your chosen language.",
  },
  notebooklm: {
    title: "NotebookLM",
    subtitle: "Short video",
    detail:
      "Your video is generating here. Watch Live pipeline for progress; Telegram is a secondary notify.",
  },
  telegram: {
    title: "Review",
    subtitle: "Approve in app",
    detail: "Approve or deny from Campaign history. Telegram also gets a preview notify.",
  },
  approve: {
    title: "Approve",
    subtitle: "Allowed",
    detail: "You approved. Publish continues if Facebook is configured.",
  },
  deny: {
    title: "Deny",
    subtitle: "Stopped",
    detail: "You denied. Nothing was posted.",
  },
  facebook: {
    title: "Facebook",
    subtitle: "Publish",
    detail: "Uploads the MP4 to your Page with the Gemini caption.",
  },
  done: {
    title: "Posted",
    subtitle: "Complete",
    detail: "Publish finished. Status stays in History; Telegram may also get a result link.",
  },
};

export const NODE_ORDER = [
  "system",
  "gemini",
  "notebooklm",
  "telegram",
  "approve",
  "deny",
  "facebook",
  "done",
];

export const EDGES = [
  { from: "system", to: "gemini" },
  { from: "gemini", to: "notebooklm" },
  { from: "notebooklm", to: "telegram" },
  { from: "telegram", to: "approve", label: "Approve" },
  { from: "telegram", to: "deny", label: "Deny" },
  { from: "approve", to: "facebook" },
  { from: "facebook", to: "done" },
];

const MAIN_PATH = ["system", "gemini", "notebooklm", "telegram"];
const APPROVE_PATH = ["approve", "facebook", "done"];

export const NODE_W = 150;
export const NODE_H = 58;
const NODE_GAP = 28;
const PAD = 24;

export const ACTIVE_STATUSES = new Set([
  "queued",
  "collecting",
  "generating",
  "awaiting_approval",
  "posting",
]);

/** Top-to-bottom canvas layout used by FlowDiagram. */
export function computeLayout(direction = "vertical") {
  const ranks = [
    ["system"],
    ["gemini"],
    ["notebooklm"],
    ["telegram"],
    ["approve", "deny"],
    ["facebook"],
    ["done"],
  ];
  const nodes = {};
  let y = PAD;
  const maxWidth = Math.max(...ranks.map((rank) => rank.length * NODE_W + (rank.length - 1) * NODE_GAP));

  ranks.forEach((rank) => {
    const blockW = rank.length * NODE_W + (rank.length - 1) * NODE_GAP;
    const startX = PAD + (maxWidth - blockW) / 2;
    rank.forEach((id, i) => {
      nodes[id] = { id, x: startX + i * (NODE_W + NODE_GAP), y };
    });
    y += NODE_H + 38;
  });

  const height = y - 38 + PAD;
  const width = maxWidth + PAD * 2;
  const edges = EDGES.map((e) => {
    const a = nodes[e.from];
    const b = nodes[e.to];
    return {
      ...e,
      sourceX: a.x + NODE_W / 2,
      sourceY: a.y + NODE_H,
      targetX: b.x + NODE_W / 2,
      targetY: b.y,
    };
  });
  return { nodes, edges, width, height, direction: "vertical" };
}

export function stageForJob(job) {
  if (!job) return null;
  if (job.stage) return job.stage;
  const status = job.status;
  if (status === "queued" || status === "collecting") return "system";
  if (status === "script_review") return "gemini";
  if (status === "generating") return job.title ? "notebooklm" : "gemini";
  if (status === "awaiting_approval") return "telegram";
  if (status === "posting") return "facebook";
  if (status === "posted") return "done";
  if (status === "denied") return "deny";
  if (status === "failed") {
    if (job.video_path) return "facebook";
    if (job.title) return "notebooklm";
    return "gemini";
  }
  return "system";
}

export function nodeStateMap(job) {
  const states = Object.fromEntries(NODE_ORDER.map((id) => [id, "idle"]));
  if (!job) return states;

  const stage = stageForJob(job);
  const status = job.status;
  const failed = status === "failed";
  const denied = status === "denied";
  const posted = status === "posted";
  const posting = status === "posting";
  const awaiting = status === "awaiting_approval";

  for (const id of MAIN_PATH) {
    const idx = MAIN_PATH.indexOf(id);
    const cur = MAIN_PATH.indexOf(stage);
    if (cur < 0) break;
    if (idx < cur) states[id] = "done";
    else if (idx === cur) states[id] = failed ? "failed" : "current";
    else states[id] = "pending";
  }

  if (awaiting) {
    states.telegram = "current";
    states.approve = "pending";
    states.deny = "pending";
  } else if (denied) {
    for (const id of MAIN_PATH) states[id] = "done";
    states.deny = "done";
    states.approve = "idle";
    for (const id of APPROVE_PATH) {
      if (id !== "approve") states[id] = "idle";
    }
  } else if (posting || posted || (failed && stage === "facebook")) {
    for (const id of MAIN_PATH) states[id] = "done";
    states.approve = "done";
    states.deny = "idle";
    if (posted) {
      states.facebook = "done";
      states.done = "done";
    } else if (posting) {
      states.facebook = "current";
      states.done = "pending";
    } else {
      states.facebook = "failed";
      states.done = "pending";
    }
  } else if (failed) {
    states.approve = "idle";
    states.deny = "idle";
    for (const id of APPROVE_PATH) {
      if (id !== "approve") states[id] = "idle";
    }
  } else {
    states.approve = "idle";
    states.deny = "idle";
    for (const id of APPROVE_PATH) {
      if (id !== "approve") states[id] = "idle";
    }
  }

  return states;
}

export function activeEdgeKeys(job) {
  const keys = new Set();
  if (!job) return keys;
  const stage = stageForJob(job);
  const status = job.status;
  const mainIdx = MAIN_PATH.indexOf(stage);

  if (mainIdx >= 0) {
    for (let i = 0; i < mainIdx; i += 1) {
      keys.add(`${MAIN_PATH[i]}->${MAIN_PATH[i + 1]}`);
    }
    if (status === "generating" || status === "queued" || status === "collecting") {
      if (mainIdx > 0) keys.add(`${MAIN_PATH[mainIdx - 1]}->${MAIN_PATH[mainIdx]}`);
    }
  }

  if (status === "awaiting_approval") keys.add("notebooklm->telegram");
  if (status === "denied") {
    keys.add("notebooklm->telegram");
    keys.add("telegram->deny");
  }
  if (status === "posting" || status === "posted" || (status === "failed" && stage === "facebook")) {
    keys.add("notebooklm->telegram");
    keys.add("telegram->approve");
    keys.add("approve->facebook");
    if (status === "posted") keys.add("facebook->done");
  }
  return keys;
}

export function liveDetailFor(job, nodeId) {
  if (!job) return STEPS[nodeId].detail;
  const stage = stageForJob(job);
  const status = job.status;

  if (nodeId === "system") {
    if (["queued", "collecting"].includes(status)) return "Your campaign is queued for generation.";
    return "Your business, audience, offer and creative direction are saved with this campaign.";
  }
  if (nodeId === "gemini") {
    if (status === "script_review") return "Choose an opening hook and review the scenes before generating your video.";
    if (stage === "gemini" && status === "generating") {
      return "Drafting the campaign caption and script from your brief…";
    }
    if (job.title) return `Title ready: ${job.title}`;
    return STEPS.gemini.detail;
  }
  if (nodeId === "notebooklm") {
    if (stage === "notebooklm" && status === "generating") {
      return "Your video is generating… rendering the script, adding captions, and checking the output. This can take several minutes.";
    }
    if (job.video_path) return "Short MP4 ready — open Campaign history to preview and approve.";
    if (job.title) return "Script ready — your video is next in Live pipeline.";
    return STEPS.notebooklm.detail;
  }
  if (nodeId === "telegram") {
    if (status === "awaiting_approval") {
      return "Video ready. Approve or deny in Campaign history (Telegram also notified).";
    }
    if (status === "denied") return "You denied this preview.";
    if (["posting", "posted"].includes(status)) return "You approved this campaign.";
    return STEPS.telegram.detail;
  }
  if (nodeId === "deny") {
    if (status === "denied") return "Pipeline stopped. Start another job when ready.";
    return STEPS.deny.detail;
  }
  if (nodeId === "approve") {
    if (["posting", "posted"].includes(status)) return "Approved — continuing to publish.";
    return STEPS.approve.detail;
  }
  if (nodeId === "facebook") {
    if (status === "posting") return "Uploading video to Facebook…";
    if (status === "posted" && job.facebook_post_url) return `Posted: ${job.facebook_post_url}`;
    if (status === "posted") return "Marked posted (Facebook may be optional/off).";
    if (status === "failed" && stage === "facebook") return job.error || "Publish failed.";
    return STEPS.facebook.detail;
  }
  if (nodeId === "done") {
    if (status === "posted") return "Pipeline complete.";
    return STEPS.done.detail;
  }
  return STEPS[nodeId].detail;
}

export function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function pickDefaultJob(list) {
  const active = list.find((j) => ACTIVE_STATUSES.has(j.status));
  return active || list[0] || null;
}
