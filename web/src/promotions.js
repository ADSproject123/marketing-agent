/** Match campaign jobs to a saved business by name in storyboard or brief. */
export function jobsForPromotion(jobs, promotion) {
  if (!promotion?.name || !Array.isArray(jobs)) return [];
  const name = String(promotion.name).trim();
  if (!name) return [];
  const needle = name.toLowerCase();

  return jobs.filter((job) => {
    const fromStoryboard = String(job?.storyboard?.business_name || "").trim().toLowerCase();
    if (fromStoryboard && fromStoryboard === needle) return true;

    const brief = String(job?.brief || "");
    // Campaign briefs include "Name: …" (EN) or "ឈ្មោះ: …" (KM).
    for (const line of brief.split(/\r?\n/)) {
      const match = line.match(/^(?:Name|ឈ្មោះ)\s*:\s*(.+)$/i);
      if (match && match[1].trim().toLowerCase() === needle) return true;
    }
    return false;
  });
}

export function jobDisplayTitle(job) {
  const raw = String(job?.title || job?.brief || "Untitled").trim();
  return raw.split(/\n/)[0] || "Untitled";
}
