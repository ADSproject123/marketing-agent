import Icon from "../Icon";
import { Button } from "../ui";
import { ChoiceGroup } from "./FormBits";
import { KINDS } from "./constants";

export default function StepBusiness({
  draft, change, fieldProps, onDraftChange, profileError,
  ingestUrl, setIngestUrl, ingestBusy, importFromUrl, busy,
}) {
  return (
    <div className="campaign-profile-form">
      <div className="campaign-import-banner">
        <div className="campaign-import-copy">
          <strong>Auto-fill from website</strong>
        </div>
        <div className="campaign-import-row">
          <input
            type="url"
            value={ingestUrl}
            onChange={(event) => { setIngestUrl(event.target.value); }}
            placeholder="https://yourbrand.com"
            maxLength={500}
            disabled={busy || ingestBusy}
            aria-label="Website URL to import"
          />
          <Button
            variant="ghost"
            size="sm"
            icon="sparkles"
            loading={ingestBusy}
            loadingText="Importing…"
            disabled={busy || ingestBusy}
            onClick={importFromUrl}
          >
            Import
          </Button>
        </div>
      </div>
      <ChoiceGroup name="kind" label="What are you promoting?" options={KINDS} value={draft.kind} onChange={(value) => onDraftChange("kind", value)} compact />
      <label className="field"><span>Business or product name</span><input {...fieldProps("name")} value={draft.name} onChange={change("name")} required maxLength={120} autoComplete="organization" placeholder="For example: Soriya Coffee" /></label>
      <label className="field"><span>What do you offer?</span><textarea {...fieldProps("description")} value={draft.description} onChange={change("description")} required maxLength={1000} rows={3} placeholder="A neighborhood café serving locally roasted coffee and fresh pastries." /></label>
      <label className="field"><span>Why should someone choose you?</span><textarea {...fieldProps("benefit")} value={draft.benefit} onChange={change("benefit")} required maxLength={500} rows={2} placeholder="Freshly roasted beans, a quiet place to work, and friendly service." /></label>
      <div className="campaign-field-pair">
        <label className="field"><span>Location <span className="campaign-optional">Optional</span></span><input {...fieldProps("location")} value={draft.location} onChange={change("location")} maxLength={300} autoComplete="street-address" placeholder="City, neighborhood, or address" /></label>
        <label className="field"><span>Website <span className="campaign-optional">Optional</span></span><input {...fieldProps("website")} value={draft.website} onChange={change("website")} maxLength={500} inputMode="url" autoComplete="url" placeholder="https://yourbrand.com" /></label>
      </div>
      {profileError ? <p className="campaign-form-error" role="alert">{profileError}</p> : null}
    </div>
  );
}
