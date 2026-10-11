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
    khmer: {
      brief:
        "កម្មវិធីបញ្ចុះតម្លៃចុងសប្ដាហ៍៖ បញ្ចុះតម្លៃ ២០% លើទំនិញទាំងអស់ តែថ្ងៃសៅរ៍ និងថ្ងៃអាទិត្យនេះប៉ុណ្ណោះ។ បង្ហាញភាពស្និទ្ធស្នាលជាមួយសហគមន៍ និងជំរុញឱ្យអតិថិជនសម្រេចចិត្តដោយរួសរាយ។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
      notes:
        "ប្រើសំនៀងកក់ក្ដៅ និងស្និទ្ធស្នាល ហើយបញ្ជាក់ថាឱកាសនេះមានរយៈពេលកំណត់។ ទាក់ទាញចំណាប់អារម្មណ៍ក្នុង ៣ វិនាទីដំបូង។ អំពាវនាវឱ្យអតិថិជនមកទិញនៅចុងសប្ដាហ៍នេះ ឬទិញឥឡូវនេះ។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
    },
  },
  {
    id: "product_launch",
    label: "Product launch",
    brief:
      "Launch day for a new product drop. Show what it is, why it matters, and one clear CTA to try or buy.",
    notes:
      "Tone: bold, clean, hype without spam. Focus on one hero benefit + social proof vibe.",
    khmer: {
      brief:
        "ផ្សព្វផ្សាយការដាក់លក់ផលិតផលថ្មី។ បង្ហាញថាផលិតផលនេះជាអ្វី ហេតុអ្វីវាមានប្រយោជន៍ និងបញ្ចប់ដោយការអំពាវនាវច្បាស់លាស់មួយឱ្យសាកល្បង ឬទិញ។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
      notes:
        "ប្រើសំនៀងជឿជាក់ សាមញ្ញ និងរំភើបដោយមិនផ្សព្វផ្សាយហួសហេតុ។ ផ្ដោតលើអត្ថប្រយោជន៍សំខាន់មួយ និងបង្ហាញមូលហេតុដែលអតិថិជនអាចទុកចិត្តបាន។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
    },
  },
  {
    id: "local_cafe",
    label: "Local cafe / F&B",
    brief:
      "Promo for a neighborhood cafe — signature drink highlight and a limited-time offer this week.",
    notes:
      "Tone: cozy, visual food energy, inviting. Vertical TikTok pacing.",
    khmer: {
      brief:
        "ផ្សព្វផ្សាយហាងកាហ្វេក្នុងសហគមន៍ ដោយរំលេចភេសជ្ជៈពិសេសប្រចាំហាង និងការផ្ដល់ជូនដែលមានរយៈពេលកំណត់ក្នុងសប្ដាហ៍នេះ។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
      notes:
        "ប្រើសំនៀងកក់ក្ដៅ និងអញ្ជើញអតិថិជនដោយរួសរាយ។ បង្ហាញអាហារ និងភេសជ្ជៈឱ្យមើលទៅគួរឱ្យចង់សាកល្បង។ ប្រើវីដេអូបញ្ឈរដែលមានចង្វាក់រហ័ស សមស្របសម្រាប់ TikTok។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
    },
  },
  {
    id: "app_feature",
    label: "App / feature highlight",
    brief:
      "Short promo for a mobile app feature that saves people time. Show the problem → the feature → the win.",
    notes:
      "Tone: crisp, modern, demo-like. One feature only. CTA: download / try free.",
    khmer: {
      brief:
        "បង្កើតវីដេអូផ្សព្វផ្សាយខ្លីសម្រាប់មុខងារមួយនៃកម្មវិធីទូរសព្ទដែលជួយសន្សំពេលវេលា។ បង្ហាញបញ្ហាដែលអ្នកប្រើប្រាស់ជួប បន្ទាប់មកបង្ហាញមុខងារដោះស្រាយ និងលទ្ធផលដែលពួកគេទទួលបាន។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
      notes:
        "ប្រើសំនៀងច្បាស់លាស់ ទំនើប និងបង្ហាញរបៀបប្រើជាក់ស្ដែង។ ផ្ដោតលើមុខងារតែមួយ។ អំពាវនាវឱ្យទាញយកកម្មវិធី ឬសាកល្បងដោយឥតគិតថ្លៃ។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
    },
  },
  {
    id: "seasonal",
    label: "Seasonal / holiday",
    brief:
      "Seasonal campaign tied to the current season or holiday. Gift angle + limited-time offer.",
    notes:
      "Tone: festive but not cheesy. Fast cuts, clear offer, soft CTA.",
    khmer: {
      brief:
        "បង្កើតយុទ្ធនាការផ្សព្វផ្សាយស្របនឹងរដូវកាល ឬពិធីបុណ្យបច្ចុប្បន្ន។ បង្ហាញគំនិតសម្រាប់អំណោយ និងការផ្ដល់ជូនដែលមានរយៈពេលកំណត់។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
      notes:
        "ប្រើសំនៀងរីករាយសមនឹងពិធីបុណ្យ ដោយរក្សាភាពធម្មជាតិ។ ផ្លាស់ប្ដូរឈុតឱ្យរហ័ស បង្ហាញការផ្ដល់ជូនឱ្យច្បាស់ និងអំពាវនាវដោយទន់ភ្លន់។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
    },
  },
  {
    id: "auto_gemini",
    label: "Let Gemini invent everything",
    brief: "",
    notes: "Operator chose full auto — invent a fresh short-form campaign from scratch.",
    khmer: {
      brief:
        "បង្កើតគំនិតយុទ្ធនាការផ្សព្វផ្សាយថ្មីទាំងស្រុងសម្រាប់វីដេអូខ្លី ដោយជ្រើសរើសផលិតផល ក្រុមអតិថិជនគោលដៅ និងការផ្ដល់ជូនដែលទាក់ទាញ។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
      notes:
        "អ្នកប្រើប្រាស់បានជ្រើសរើសការបង្កើតដោយស្វ័យប្រវត្តិ។ សូមបង្កើតគំនិតថ្មី អត្ថបទផ្សព្វផ្សាយ ស្គ្រីប និងការណែនាំច្នៃប្រឌិតទាំងអស់ជាភាសាខ្មែរ។ សូមបង្កើតវីដេអូជាភាសាខ្មែរ។",
    },
  },
];

export function templateById(id, language = "en") {
  const template = TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];
  return language === "km" && template.khmer
    ? { ...template, ...template.khmer }
    : template;
}

/** Translate template defaults while keeping anything the user has edited. */
export function localizeTemplateDraft({ templateId, language, nextLanguage, brief, notes }) {
  if (!templateId) return { brief, notes };
  const previous = templateById(templateId, language);
  const next = templateById(templateId, nextLanguage);
  return {
    brief: brief === previous.brief ? next.brief : brief,
    notes: notes === previous.notes ? next.notes : notes,
  };
}
