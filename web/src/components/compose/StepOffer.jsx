import { CAMPAIGN_ASSET_LIMITS } from "../../campaign";
import { Button } from "../ui";
import { CTA_LABELS } from "./constants";

export default function StepOffer({
  draft, change, fieldProps, onDraftChange, destinationCopy, destinationRequired, khqrPreview,
}) {
  return (
    <>
      <label className="field"><span>Special offer <span className="campaign-optional">Optional</span></span><textarea {...fieldProps("offer")} value={draft.offer} onChange={change("offer")} maxLength={400} rows={2} placeholder="e.g. Free pastry with every large coffee this weekend" /></label>
      <label className="field"><span>Offer timing <span className="campaign-optional">Optional</span></span><input {...fieldProps("offerTiming")} value={draft.offerTiming} onChange={change("offerTiming")} maxLength={200} placeholder="e.g. Oct 12–14" /></label>
      <label className="field"><span>Call to action</span><select {...fieldProps("cta")} value={draft.cta} onChange={change("cta")}>{Object.entries(CTA_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field"><span>{destinationCopy[0]} {!destinationRequired ? <span className="campaign-optional">Optional</span> : null}</span><input {...fieldProps("destination")} value={draft.destination} onChange={change("destination")} maxLength={400} required={destinationRequired} placeholder={destinationCopy[1]} /></label>
      <div className="campaign-field-pair">
        <label className="field">
          <span>Telegram <span className="campaign-optional">Optional</span></span>
          <input
            {...fieldProps("telegramUsername")}
            value={draft.telegramUsername || ""}
            onChange={change("telegramUsername")}
            maxLength={32}
            placeholder="@yourshop"
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>KHQR image <span className="campaign-optional">Optional</span></span>
          <input
            {...fieldProps("khqrFile")}
            type="file"
            accept={CAMPAIGN_ASSET_LIMITS.accept.join(",")}
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              onDraftChange("khqrFile", file);
              event.target.value = "";
            }}
          />
          {draft.khqrFile ? (
            <div className="campaign-khqr-preview">
              {khqrPreview ? <img src={khqrPreview} alt="Uploaded KHQR" /> : null}
              <span>{draft.khqrFile.name}</span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onDraftChange("khqrFile", null)}
                className="campaign-assets-remove"
              >
                Remove
              </Button>
            </div>
          ) : null}
        </label>
      </div>
    </>
  );
}
