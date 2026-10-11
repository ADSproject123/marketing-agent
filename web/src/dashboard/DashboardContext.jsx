import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPromotion, fetchHealth, fetchJob, fetchJobs, fetchPromotions, createCampaignDraft as generateScript, saveStoryboard, reviseStoryboard, renderStoryboard } from "../api";
import { useAuth } from "../auth";
import { ACTIVE_STATUSES, pickDefaultJob } from "../flow";
import { buildCampaignRequest, createCampaignDraft, validateCampaignStep } from "../campaign";
import { draftFromDemo } from "../demos";
import { storyboardPayload, validateStoryboard } from "../storyboard";

const DashboardContext = createContext(null);
const PROFILE_FIELDS = ["kind", "name", "description", "benefit", "location", "website"];
const STEP_FIELDS = [PROFILE_FIELDS, ["goal", "audience"], ["offer", "offerTiming", "cta", "destination"], ["style", "templateId", "language", "extraNotes", "urls", "assets"]];

function profileDraft(profile) {
  return Object.fromEntries(PROFILE_FIELDS.map((field) => [field, profile[field] || ""]));
}

export function DashboardProvider({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [healthLabel, setHealthLabel] = useState("checking…");
  const [online, setOnline] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsError, setJobsError] = useState("");
  const [activeJobId, setActiveJobId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startStatus, setStartStatus] = useState("");
  const [startStatusClass, setStartStatusClass] = useState("");

  const [campaignDraft, setCampaignDraft] = useState(createCampaignDraft);
  const [campaignStep, setCampaignStep] = useState(0);
  const [businessView, setBusinessView] = useState("list");
  const [campaignErrors, setCampaignErrors] = useState({});
  const [promotions, setPromotions] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [savingPromotion, setSavingPromotion] = useState(false);
  const [profileError, setProfileError] = useState("");
  const submitting = useRef(false);
  const [scriptJob, setScriptJob] = useState(null);
  const [storyboard, setStoryboard] = useState(null);
  const [scriptErrors, setScriptErrors] = useState({});
  const [scriptBusy, setScriptBusy] = useState("");
  const [scriptStatus, setScriptStatus] = useState("");
  const [scriptStatusClass, setScriptStatusClass] = useState("");
  const [scriptDirty, setScriptDirty] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptLoadError, setScriptLoadError] = useState("");
  const [scriptSetupId, setScriptSetupId] = useState(null);
  const scriptLoadRequest = useRef(0);
  const draftId = location.pathname === "/dashboard/compose" ? new URLSearchParams(location.search).get("draft") : null;

  const activeJob = useMemo(
    () => jobs.find((j) => j.id === activeJobId) || null,
    [jobs, activeJobId]
  );

  const pipelineBadge = useMemo(() => {
    if (!activeJob) return null;
    if (ACTIVE_STATUSES.has(activeJob.status)) return { label: "live", kind: "live" };
    if (activeJob.status === "posted" || activeJob.status === "denied") {
      return { label: "done", kind: "done" };
    }
    if (activeJob.status === "failed") return { label: "failed", kind: "failed" };
    return null;
  }, [activeJob]);

  const liveCount = useMemo(
    () => jobs.filter((j) => ACTIVE_STATUSES.has(j.status)).length,
    [jobs]
  );

  const loadHealth = useCallback(async () => {
    try {
      const data = await fetchHealth();
      const ready = Boolean(data.runtime_ready);
      setOnline(ready);
      setHealthLabel(
        ready ? "system online · telegram ready" : "dashboard only · start runtime"
      );
    } catch {
      setOnline(false);
      setHealthLabel("dashboard offline");
    }
  }, []);

  const loadJobs = useCallback(
    async (preferredId) => {
      try {
        const data = await fetchJobs(20);
        const list = data.jobs || [];
        setJobs(list);
        setJobsError("");
        setActiveJobId((prev) => {
          const want = preferredId || prev;
          if (want && list.some((j) => j.id === want)) return want;
          return pickDefaultJob(list)?.id || null;
        });
      } catch (err) {
        setJobsError(String(err.message || err));
        if (err.status === 401) logout();
      }
    },
    [logout]
  );

  const loadPromotions = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const data = await fetchPromotions();
      setPromotions(data.promotions || []);
      setProfileError("");
    } catch (err) {
      setProfileError(String(err.message || err));
      if (err.status === 401) logout();
    } finally {
      setProfilesLoading(false);
    }
  }, [logout]);

  const loadScriptDraft = useCallback(async (id) => {
    const request = ++scriptLoadRequest.current;
    setScriptLoading(true);
    setScriptLoadError("");
    try {
      const data = await fetchJob(id);
      const job = data.job || data;
      if (request !== scriptLoadRequest.current) return;
      if (!job?.storyboard || !["script_review", "failed"].includes(job.status)) {
        throw new Error("This campaign is not an editable script draft. Open its campaign details to view the current progress.");
      }
      setScriptJob(job);
      setStoryboard(job.storyboard);
      setScriptDirty(false);
      setScriptErrors({});
      setScriptStatus("");
      setCampaignStep(5);
      setActiveJobId(job.id);
    } catch (err) {
      if (request !== scriptLoadRequest.current) return;
      setScriptLoadError(String(err.message || err));
      if (err.status === 401) logout();
    } finally {
      if (request === scriptLoadRequest.current) setScriptLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    if (draftId) {
      if (scriptJob?.id !== draftId || !storyboard) loadScriptDraft(draftId);
    } else if (location.pathname === "/dashboard/compose" && scriptJob) {
      ++scriptLoadRequest.current;
      setScriptJob(null);
      setStoryboard(null);
      setScriptLoading(false);
      setScriptLoadError("");
      setCampaignStep(0);
      setBusinessView("list");
    }
    // Local scene edits should not trigger a new server fetch.
  }, [draftId, location.pathname, loadScriptDraft]);

  useEffect(() => {
    loadHealth();
    loadJobs();
    loadPromotions();
    const healthTimer = setInterval(loadHealth, 15000);
    return () => clearInterval(healthTimer);
  }, [loadHealth, loadJobs, loadPromotions]);

  useEffect(() => {
    const ms = activeJob && ACTIVE_STATUSES.has(activeJob.status) ? 2500 : 8000;
    const timer = setInterval(() => loadJobs(), ms);
    return () => clearInterval(timer);
  }, [activeJob, loadJobs]);

  const onCampaignDraftChange = useCallback((field, value) => {
    if (submitting.current) return;
    setCampaignDraft((previous) => {
      if (!(field in previous) || field === "promotionId") return previous;
      return {
        ...previous,
        [field]: value,
        promotionId: PROFILE_FIELDS.includes(field) && value !== previous[field] ? "" : previous.promotionId,
        ...(field === "kind" ? { cta: { shop: "visit", product: "buy", service: "message", other: "learn" }[value] || "learn" } : {}),
      };
    });
    setCampaignErrors((previous) => {
      const next = { ...previous };
      delete next[field];
      return next;
    });
    setProfileError("");
    setStartStatus("");
  }, []);

  const onPromotionSelect = useCallback((id) => {
    if (submitting.current) return;
    const profile = promotions.find((item) => item.id === id);
    if (id && !profile) return;
    setCampaignDraft((previous) => ({
      ...previous,
      ...(profile ? profileDraft(profile) : profileDraft(createCampaignDraft())),
      promotionId: profile?.id || "",
      cta: { shop: "visit", product: "buy", service: "message", other: "learn" }[profile?.kind || "shop"],
      assets: [],
    }));
    setCampaignErrors({});
    setProfileError("");
    setStartStatus("");
  }, [promotions]);

  const onDemoSelect = useCallback((id) => {
    if (submitting.current) return;
    const draft = draftFromDemo(id);
    if (!draft) return;
    setCampaignDraft(draft);
    setCampaignStep(4);
    setCampaignErrors({});
    setProfileError("");
    setStartStatus("Demo loaded — review and generate to test the full flow.");
    setStartStatusClass("");
  }, []);

  const onCampaignEditStep = useCallback((step) => {
    if (submitting.current || step < 0 || step > 4) return;
    if (step === 0) setBusinessView("form");
    setCampaignStep(step);
    setCampaignErrors({});
    setStartStatus("");
  }, []);

  const onCampaignBack = useCallback(() => {
    if (submitting.current) return;
    setCampaignStep((previous) => {
      if (previous === 1) setBusinessView("form");
      return Math.max(0, previous - 1);
    });
    setCampaignErrors({});
    setStartStatus("");
  }, []);

  const onCampaignSubmit = useCallback(
    async (ev) => {
      ev.preventDefault();
      if (submitting.current) return;
      const errors = validateCampaignStep(campaignDraft, campaignStep);
      setCampaignErrors(errors);
      if (Object.keys(errors).length) {
        if (campaignStep === 4) {
          const step = STEP_FIELDS.findIndex((fields) => fields.includes(Object.keys(errors)[0]));
          if (step >= 0) setCampaignStep(step);
        }
        return;
      }
      setStartStatus("");

      if (campaignStep < 4) {
        if (campaignStep === 0 && !campaignDraft.promotionId) {
          submitting.current = true;
          setSavingPromotion(true);
          setProfileError("");
          try {
            const data = await createPromotion(profileDraft(campaignDraft));
            const profile = data.promotion;
            if (!profile?.id) throw new Error("Your business profile could not be saved. Please try again.");
            setPromotions((previous) => [profile, ...previous.filter((item) => item.id !== profile.id)]);
            setCampaignDraft((previous) => ({ ...previous, ...profileDraft(profile), promotionId: profile.id }));
            setCampaignStep(1);
          } catch (err) {
            setProfileError(String(err.message || err));
            if (err.status === 401) logout();
          } finally {
            submitting.current = false;
            setSavingPromotion(false);
          }
        } else {
          setCampaignStep(campaignStep + 1);
        }
        return;
      }

      submitting.current = true;
      setStarting(true);
      setStartStatusClass("");
      setStartStatus("Writing your script…");
      try {
        const data = await generateScript(buildCampaignRequest(campaignDraft));
        if (!data.job?.storyboard || !data.job.id) throw new Error("The script could not be loaded. Please try again.");
        setStartStatusClass("is-ok");
        setStartStatus("");
        setScriptJob(data.job);
        setScriptSetupId(data.job.id);
        setStoryboard(data.job.storyboard);
        setScriptDirty(false);
        setScriptErrors({});
        setScriptStatus("");
        setScriptLoadError("");
        setCampaignStep(5);
        setActiveJobId(data.job.id);
        setJobs((previous) => [data.job, ...previous.filter((job) => job.id !== data.job.id)]);
        navigate(`/dashboard/compose?draft=${encodeURIComponent(data.job.id)}`);
      } catch (err) {
        if (err.errors) setCampaignErrors(err.errors);
        setStartStatusClass("is-err");
        setStartStatus(String(err.message || err));
        if (err.status === 401) logout();
      } finally {
        submitting.current = false;
        setStarting(false);
      }
    },
    [campaignDraft, campaignStep, loadJobs, navigate, logout]
  );

  const onStoryboardChange = useCallback((next) => {
    if (submitting.current) return;
    setStoryboard(next);
    setScriptDirty(true);
    setScriptErrors({});
    setScriptStatus("");
  }, []);

  const onStoryboardAction = useCallback(async (action) => {
    if (submitting.current || !scriptJob || !storyboard) return;
    const errors = validateStoryboard(storyboard);
    setScriptErrors(errors);
    if (Object.keys(errors).length) return;
    submitting.current = true;
    setScriptBusy(action);
    setScriptStatusClass("");
    setScriptStatus(action === "render" ? "Starting your video…" : action === "save" ? "Saving your script…" : "Revising your script…");
    try {
      const payload = storyboardPayload(storyboard);
      const data = action === "render"
        ? await renderStoryboard(scriptJob.id, payload, scriptJob.updated_at)
        : action === "save"
          ? await saveStoryboard(scriptJob.id, payload, scriptJob.updated_at)
          : await reviseStoryboard(scriptJob.id, action, payload, scriptJob.updated_at);
      if (!data.job?.id) throw new Error("The script could not be saved. Please try again.");
      setScriptJob(data.job);
      setStoryboard(data.job.storyboard || payload);
      setScriptDirty(false);
      setScriptStatusClass("is-ok");
      setScriptStatus(data.message || (action === "save" ? "Script saved." : "Script updated."));
      setJobs((previous) => [data.job, ...previous.filter((job) => job.id !== data.job.id)]);
      if (action === "render") {
        setActiveJobId(data.job.id);
        setCampaignDraft(createCampaignDraft({ ...profileDraft(campaignDraft), promotionId: campaignDraft.promotionId, language: data.job.storyboard?.language || campaignDraft.language }));
        setCampaignStep(0);
        setBusinessView("list");
        setScriptJob(null);
        setStoryboard(null);
        navigate("/dashboard/pipeline");
      }
    } catch (err) {
      setScriptStatusClass("is-err");
      setScriptStatus(String(err.message || err));
      if (err.status === 401) logout();
    } finally {
      submitting.current = false;
      setScriptBusy("");
    }
  }, [scriptJob, storyboard, campaignDraft, logout, navigate]);

  const onReloadScript = useCallback(() => {
    if (!submitting.current && draftId) loadScriptDraft(draftId);
  }, [draftId, loadScriptDraft]);

  const value = useMemo(
    () => ({
      healthLabel,
      online,
      jobs,
      jobsError,
      activeJobId,
      setActiveJobId,
      activeJob,
      pipelineBadge,
      liveCount,
      loadJobs,
      campaignDraft,
      campaignStep,
      businessView,
      setBusinessView,
      campaignErrors,
      promotions,
      profilesLoading,
      savingPromotion,
      profileError,
      starting,
      startStatus,
      startStatusClass,
      onCampaignDraftChange,
      onPromotionSelect,
      onDemoSelect,
      onCampaignSubmit,
      onCampaignBack,
      onCampaignEditStep,
      scriptJob, storyboard, scriptErrors, scriptBusy, scriptStatus, scriptStatusClass,
      scriptDirty, scriptLoading, scriptLoadError, onStoryboardChange, onStoryboardAction, onReloadScript,
      scriptCanEditSetup: scriptSetupId === scriptJob?.id,
    }),
    [
      healthLabel,
      online,
      jobs,
      jobsError,
      activeJobId,
      activeJob,
      pipelineBadge,
      liveCount,
      loadJobs,
      campaignDraft,
      campaignStep,
      businessView,
      campaignErrors,
      promotions,
      profilesLoading,
      savingPromotion,
      profileError,
      starting,
      startStatus,
      startStatusClass,
      onCampaignDraftChange,
      onPromotionSelect,
      onDemoSelect,
      onCampaignSubmit,
      onCampaignBack,
      onCampaignEditStep,
      scriptJob, storyboard, scriptErrors, scriptBusy, scriptStatus, scriptStatusClass,
      scriptDirty, scriptLoading, scriptLoadError, onStoryboardChange, onStoryboardAction, onReloadScript,
      scriptSetupId,
    ]
  );

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
