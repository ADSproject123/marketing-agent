/** Predefined campaign templates — picking one prefills brief + notes. */
export const TEMPLATES = [
  {
    id: "",
    label: "Custom (write your own)",
    brief: "",
    notes: "",
  },
  {
    id: "weekend_sale",
    label: "Weekend sale",
    brief:
      "Weekend flash sale: 20% off everything this Saturday and Sunday only. Local feel, urgent but friendly.",
    notes:
      "Tone: warm, local, FOMO. Hook in 3 seconds. CTA: come in this weekend / shop now.",
  },
  {
    id: "product_launch",
    label: "Product launch",
    brief:
      "Launch day for a new product drop. Show what it is, why it matters, and one clear CTA to try or buy.",
    notes:
      "Tone: bold, clean, hype without spam. Focus on one hero benefit + social proof vibe.",
  },
  {
    id: "local_cafe",
    label: "Local cafe / F&B",
    brief:
      "Promo for a neighborhood cafe — signature drink highlight and a limited-time offer this week.",
    notes:
      "Tone: cozy, visual food energy, inviting. Vertical TikTok pacing.",
  },
  {
    id: "app_feature",
    label: "App / feature highlight",
    brief:
      "Short promo for a mobile app feature that saves people time. Show the problem → the feature → the win.",
    notes:
      "Tone: crisp, modern, demo-like. One feature only. CTA: download / try free.",
  },
  {
    id: "seasonal",
    label: "Seasonal / holiday",
    brief:
      "Seasonal campaign tied to the current season or holiday. Gift angle + limited-time offer.",
    notes:
      "Tone: festive but not cheesy. Fast cuts, clear offer, soft CTA.",
  },
  {
    id: "auto_gemini",
    label: "Let Gemini invent everything",
    brief: "",
    notes: "Operator chose full auto — invent a fresh short-form campaign from scratch.",
  },
];

export function templateById(id) {
  return TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
}
