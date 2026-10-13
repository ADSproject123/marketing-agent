import { ChoiceGroup } from "./FormBits";
import { AUDIENCES, GOALS } from "./constants";

export default function StepAudience({ draft, change, fieldProps, onDraftChange }) {
  const presetSelected = AUDIENCES.some((item) => item.value === draft.audience);

  return (
    <>
      <ChoiceGroup name="goal" label="Goal" options={GOALS} value={draft.goal} onChange={(value) => onDraftChange("goal", value)} />
      <ChoiceGroup
        name="audiencePreset"
        label="Audience"
        options={AUDIENCES}
        value={presetSelected ? draft.audience : ""}
        onChange={(value) => onDraftChange("audience", value)}
        compact
      />
      <label className="field">
        <span>Target audience</span>
        <textarea
          {...fieldProps("audience")}
          value={draft.audience}
          onChange={change("audience")}
          required
          maxLength={500}
          rows={3}
          placeholder="Who should this reach?"
        />
      </label>
    </>
  );
}
