import { useEffect, useRef, useState } from "react";
import { fetchPrivateMedia } from "../api";
import { selectStoryboardHook, storyboardDuration, updateStoryboardHook, updateStoryboardScene } from "../storyboard";
import Icon from "./Icon";

const REVISIONS = [
  ["stronger_hook", "Stronger opening", "Try three more compelling hooks"],
  ["shorter", "Make it shorter", "Tighten the script and pacing"],
  ["change_ending", "Change the ending", "Improve the final call to action"],
];

export default function StoryboardEditor({ job, storyboard, errors = {}, busy = "", dirty, status, statusClass, onChange, onAction, onReload, onBack }) {
  const headingRef = useRef(null);
  const [previews, setPreviews] = useState({});
  const [previewError, setPreviewError] = useState(false);
  const assets = job.assets || [];
  const duration = storyboardDuration(storyboard);
  const locked = Boolean(busy);
  const change = (field, value) => onChange({ ...storyboard, [field]: value });
  const sceneChange = (id, field, value) => onChange(updateStoryboardScene(storyboard, id, field, value));
  const error = (field) => errors[field] ? <span id={`script-error-${field}`} className="field-error">{errors[field]}</span> : null;
  const inputProps = (field) => ({ "aria-invalid": Boolean(errors[field]), "aria-describedby": errors[field] ? `script-error-${field}` : undefined });

  useEffect(() => { headingRef.current?.focus(); }, [job.id]);
  useEffect(() => {
    const controller = new AbortController();
    const urls = [];
    setPreviews({});
    setPreviewError(false);
    Promise.all(assets.map(async (asset) => {
      try {
        const blob = await fetchPrivateMedia(asset.url, controller.signal);
        if (controller.signal.aborted) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return [asset.id, url];
      } catch (err) {
        if (!controller.signal.aborted) setPreviewError(true);
        return null;
      }
    })).then((items) => {
      if (!controller.signal.aborted) setPreviews(Object.fromEntries(items.filter(Boolean)));
    });
    return () => { controller.abort(); urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [job.id, job.assets]);

  const addScene = () => {
    onChange({ ...storyboard, scenes: [...storyboard.scenes, { id: crypto.randomUUID(), duration_seconds: 4, narration: "", on_screen_text: "", visual_direction: "", asset_id: null }] });
  };

  return (
    <section className="panel storyboard-editor" aria-labelledby="script-title">
      <header className="storyboard-head">
        <div><p className="panel-kicker">Script review</p><h2 id="script-title" ref={headingRef} tabIndex={-1}>Shape your video</h2><p>Choose an opening, then edit the words and visuals before generating.</p></div>
        <div className="storyboard-badges"><span>{storyboard.language === "km" ? "ខ្មែរ · Khmer" : "English"}</span><span className={duration < 10 || duration > 60 ? "is-invalid" : ""}>{Number(duration.toFixed(1))} seconds</span><span>9:16 vertical</span></div>
      </header>

      <form className="storyboard-form" onSubmit={(event) => { event.preventDefault(); onAction("render"); }}>
        {Object.keys(errors).length ? <div className="campaign-form-error" role="alert"><p>Check your script before continuing.</p><ul>{[...new Set(Object.values(errors))].map((message) => <li key={message}>{message}</li>)}</ul></div> : null}
        <fieldset disabled={locked} className="storyboard-fields">
          <section className="storyboard-section">
            <div className="storyboard-section-head"><div><h3>Pick your opening</h3><p>The selected hook becomes the first scene’s narration.</p></div><span>First 2–5 seconds</span></div>
            <div className="storyboard-hooks" role="radiogroup" aria-label="Video opening">
              {storyboard.hooks.map((hook, index) => (
                <div key={hook.id} className={`storyboard-hook ${storyboard.selected_hook === hook.id ? "is-selected" : ""}`}>
                  <label className="storyboard-hook-choice"><input type="radio" name="selected-hook" value={hook.id} checked={storyboard.selected_hook === hook.id} onChange={() => onChange(selectStoryboardHook(storyboard, hook.id))} /><span>Opening {index + 1}</span><span className="storyboard-hook-tag">{storyboard.selected_hook === hook.id ? "Selected" : "Choose"}</span></label>
                  <label className="sr-only" htmlFor={`hook-${hook.id}`}>Opening {index + 1} text</label>
                  <textarea id={`hook-${hook.id}`} value={hook.text} maxLength={300} rows={3} onChange={(event) => onChange(updateStoryboardHook(storyboard, hook.id, event.target.value))} {...inputProps(`hook-${hook.id}`)} />
                  {error(`hook-${hook.id}`)}
                </div>
              ))}
            </div>
          </section>

          <section className="storyboard-section">
            <div className="storyboard-section-head"><div><h3>Build your scenes</h3><p>Narration guides the spoken script and subtitles. On-screen text is a separate, short message.</p></div><span>{storyboard.scenes.length} scenes</span></div>
            <div className="storyboard-scenes">
              {storyboard.scenes.map((scene, index) => {
                const prefix = `scene-${scene.id}-`;
                const from = storyboard.scenes.slice(0, index).reduce((total, item) => total + (Number(item.duration_seconds) || 0), 0);
                const asset = assets.find((item) => item.id === scene.asset_id);
                return (
                  <section key={scene.id} className="storyboard-scene" aria-labelledby={`scene-title-${scene.id}`}>
                    <div className="storyboard-scene-head"><span className="storyboard-scene-number">{index + 1}</span><div><h4 id={`scene-title-${scene.id}`}>{index === 0 ? "Opening hook" : index === storyboard.scenes.length - 1 ? "Closing action" : `Scene ${index + 1}`}</h4><span>{Number(from.toFixed(1))}–{Number((from + (Number(scene.duration_seconds) || 0)).toFixed(1))}s</span></div><label className="storyboard-duration">Duration<input type="number" min={index === 0 ? 2 : 1} max={index === 0 ? 5 : 20} step="0.5" value={scene.duration_seconds} onChange={(event) => sceneChange(scene.id, "duration_seconds", event.target.value)} aria-label={`Scene ${index + 1} duration in seconds`} {...inputProps(`${prefix}duration_seconds`)} /><span>sec</span></label>{index > 0 && storyboard.scenes.length > 3 ? <button type="button" className="storyboard-remove" onClick={() => onChange({ ...storyboard, scenes: storyboard.scenes.filter((item) => item.id !== scene.id) })} aria-label={`Remove scene ${index + 1}`}><Icon name="x" size={16} /></button> : null}</div>
                    {error(`${prefix}duration_seconds`)}
                    <div className="storyboard-scene-grid">
                      <label className="field">Narration<textarea aria-label={`Scene ${index + 1} narration`} rows={3} maxLength={600} value={scene.narration} onChange={(event) => sceneChange(scene.id, "narration", event.target.value)} {...inputProps(`${prefix}narration`)} />{error(`${prefix}narration`)}</label>
                      <label className="field">On-screen text<textarea aria-label={`Scene ${index + 1} on-screen text`} rows={3} maxLength={300} value={scene.on_screen_text || ""} onChange={(event) => sceneChange(scene.id, "on_screen_text", event.target.value)} placeholder="A short headline or key benefit" {...inputProps(`${prefix}on_screen_text`)} />{error(`${prefix}on_screen_text`)}</label>
                      <label className="field">Visual direction<textarea aria-label={`Scene ${index + 1} visual direction`} rows={2} maxLength={600} value={scene.visual_direction} onChange={(event) => sceneChange(scene.id, "visual_direction", event.target.value)} {...inputProps(`${prefix}visual_direction`)} />{error(`${prefix}visual_direction`)}</label>
                      <div className="storyboard-asset-field"><label className="field" htmlFor={`scene-asset-${scene.id}`}>Photo or logo<select id={`scene-asset-${scene.id}`} value={scene.asset_id || ""} onChange={(event) => sceneChange(scene.id, "asset_id", event.target.value || null)}><option value="">Let the video choose visuals</option>{assets.map((item) => <option key={item.id} value={item.id}>{item.title || item.name}</option>)}</select></label>{asset ? <div className="storyboard-asset-preview">{previews[asset.id] ? <img src={previews[asset.id]} alt={asset.title || asset.name || "Selected campaign image"} /> : <span><Icon name="file" size={20} /></span>}<p>{asset.title || asset.name}</p></div> : <p className="storyboard-field-note">{assets.length ? "Choose one of your uploaded images for this scene." : "No images were uploaded for this campaign."}</p>}</div>
                    </div>
                  </section>
                );
              })}
            </div>
            {previewError ? <p className="storyboard-field-note">Some image previews could not load. Your image selections are still saved with the script.</p> : null}
            {storyboard.scenes.length < 8 ? <button type="button" className="ghost-btn storyboard-add" onClick={addScene}><Icon name="plus" size={14} /> Add scene</button> : null}
          </section>

          <section className="storyboard-section">
            <div className="storyboard-section-head"><div><h3>Campaign details</h3><p>Your business facts come from the campaign setup.</p></div></div>
            <dl className="storyboard-facts"><div><dt>Business</dt><dd>{storyboard.business_name || "—"}</dd></div>{storyboard.offer ? <div><dt>Offer</dt><dd>{storyboard.offer}</dd></div> : null}{storyboard.contact ? <div><dt>Contact or destination</dt><dd>{storyboard.contact}</dd></div> : null}</dl>
            <div className="storyboard-scene-grid">
              <label className="field storyboard-span">Campaign title<input value={storyboard.title} maxLength={60} onChange={(event) => change("title", event.target.value)} {...inputProps("title")} />{error("title")}</label>
              <label className="field storyboard-span">Social caption<textarea aria-label="Social caption" rows={3} value={storyboard.caption} maxLength={1000} onChange={(event) => change("caption", event.target.value)} {...inputProps("caption")} />{error("caption")}<span className="storyboard-field-note">This is the post’s caption. Video subtitles use the scene narration above.</span></label>
            </div>
          </section>

          <section className="storyboard-revisions" aria-label="Focused revisions"><div><h3>Want another direction?</h3><p>Revise one part while keeping your campaign setup.</p></div><div>{REVISIONS.map(([action, label, detail]) => <button key={action} type="button" className="ghost-btn" onClick={() => onAction(action)} title={detail}><Icon name="sparkles" size={14} />{busy === action ? "Revising…" : label}</button>)}</div></section>
        </fieldset>

        <div className="storyboard-review-note"><Icon name="shield" size={16} /><p>Scene timings guide generation. Review the finished voiceover, subtitles and business details in the video preview before publishing.</p></div>
        <footer className="storyboard-actions">
          <div className="storyboard-save-state"><span className={dirty ? "is-dirty" : ""}>{dirty ? "Unsaved changes" : "Draft saved"}</span><button type="button" className="campaign-edit-btn" onClick={onReload} disabled={locked}>Reload saved script</button>{onBack ? <button type="button" className="campaign-edit-btn" onClick={onBack} disabled={locked}>Campaign setup</button> : null}</div>
          <div><button type="button" className="ghost-btn" onClick={() => onAction("save")} disabled={locked}>{busy === "save" ? "Saving…" : "Save draft"}</button><button type="submit" className="primary-btn" disabled={locked}><Icon name="sparkles" size={16} />{busy === "render" ? "Starting video…" : "Generate video"}</button></div>
        </footer>
        {status ? <p className={`compose-status ${statusClass}`} role={statusClass === "is-err" ? "alert" : "status"}>{status}</p> : null}
      </form>
    </section>
  );
}
