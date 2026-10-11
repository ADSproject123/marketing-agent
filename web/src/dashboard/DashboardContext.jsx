import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPromotion, fetchHealth, fetchJob, fetchJobs, fetchPromotions, createCampaignDraft as generateScript, createWeeklyPlan, saveStoryboard, reviseStoryboard, renderStoryboard } from "../api";
import { useAuth } from "../auth";
import { ACTIVE_STATUSES, pickDefaultJob } from "../flow";
import { applyWeeklyPostToRequest, buildCampaignRequest, createCampaignDraft, validateCampaignStep } from "../campaign";
import { draftFromDemo } from "../demos";
import { fitStoryboardSpeechCadence, storyboardPayload, validateStoryboard } from "../storyboard";

const DashboardContext = createContext(null);
const PROFILE_FIELDS = ["kind", "name", "description", "benefit", "location", "website"];
const STEP_FIELDS = [PROFILE_FIELDS, ["goal", "audience"], ["offer", "offerTiming", "cta", "destination", "telegramUsername", "khqrFile"], ["style", "videoLength", "templateId", "language", "extraNotes", "urls", "assets"]];

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
  const [hasSavedDraft, setHasSavedDraft] = useState(() => {
    try {
      return Boolean(localStorage.getItem("ma_campaign_draft_v1"));
    } catch {
      return false;
    }
  });
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
  const [weeklyPlan, setWeeklyPlan] = useState(null);
  const [weeklySelectedDays, setWeeklySelectedDays] = useState([]);
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

  useEffect(() => {
    try {
      const clone = localStorage.getItem("ma_campaign_clone");
      if (clone) {
        localStorage.removeItem("ma_campaign_clone");
        const parsed = JSON.parse(clone);
        setCampaignDraft((prev) => ({
          ...prev,
          extraNotes: parsed.brief || "",
          language: parsed.language || "en",
        }));
        setCampaignStep(0);
        setBusinessView("form");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (campaignStep >= 5 || submitting.current) return;
    const timer = setTimeout(() => {
      try {
        if (
          campaignDraft.name ||
          campaignDraft.description ||
          campaignDraft.extraNotes ||
          campaignDraft.goal ||
          campaignDraft.audience
        ) {
          localStorage.setItem(
            "ma_campaign_draft_v1",
            JSON.stringify({ draft: campaignDraft, step: campaignStep })
          );
          setHasSavedDraft(true);
        }
      } catch {}
    }, 600);
    return () => clearTimeout(timer);
  }, [campaignDraft, campaignStep]);

  const onRestoreDraft = useCallback(() => {
    try {
      const raw = localStorage.getItem("ma_campaign_draft_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.draft) {
          setCampaignDraft(createCampaignDraft({ ...parsed.draft }));
          setCampaignStep(parsed.step ?? 0);
          if ((parsed.step ?? 0) === 0) setBusinessView("form");
        }
      }
    } catch {}
    setHasSavedDraft(false);
  }, []);

  const onDiscardDraft = useCallback(() => {
    try {
      localStorage.removeItem("ma_campaign_draft_v1");
    } catch {}
    setHasSavedDraft(false);
  }, []);

  const onCampaignDraftChange = useCallback((field, value) => {
    if (submitting.current || field === "promotionId") return;
    // Allow newly added draft keys even when an older in-memory/local draft omits them.
    const defaults = createCampaignDraft();
    if (!(field in defaults)) return;
    setCampaignDraft((previous) => ({
      ...previous,
      [field]: value,
      promotionId: PROFILE_FIELDS.includes(field) && value !== previous[field] ? "" : previous.promotionId,
      ...(field === "kind" ? { cta: { shop: "visit", product: "buy", service: "message", other: "learn" }[value] || "learn" } : {}),
    }));
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
      khqrFile: null,
      telegramUsername: "",
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
      if (previous === 6) {
        setStartStatus("");
        return 4;
      }
      if (previous === 1) setBusinessView("form");
      return Math.max(0, previous - 1);
    });
    setCampaignErrors({});
    setStartStatus("");
  }, []);

  const onPlanWeek = useCallback(async () => {
    if (submitting.current || campaignStep !== 4) return;
    const errors = validateCampaignStep(campaignDraft, 4);
    setCampaignErrors(errors);
    if (Object.keys(errors).length) {
      const step = STEP_FIELDS.findIndex((fields) => fields.includes(Object.keys(errors)[0]));
      if (step >= 0) setCampaignStep(step);
      return;
    }
    submitting.current = true;
    setStarting(true);
    setStartStatusClass("");
    setStartStatus("Planning your week…");
    try {
      const request = buildCampaignRequest(campaignDraft);
      const data = await createWeeklyPlan({
        brief: request.brief,
        notes: request.notes,
        urls: request.urls,
        language: request.language,
      });
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      if (posts.length !== 3) throw new Error("The weekly plan could not be loaded. Please try again.");
      setWeeklyPlan(posts);
      setWeeklySelectedDays(posts.map((post) => post.day));
      setCampaignStep(6);
      setStartStatus("");
      setStartStatusClass("");
    } catch (err) {
      if (err.errors) setCampaignErrors(err.errors);
      setStartStatusClass("is-err");
      setStartStatus(String(err.message || err));
      if (err.status === 401) logout();
    } finally {
      submitting.current = false;
      setStarting(false);
    }
  }, [campaignDraft, campaignStep, logout]);

  const onWeeklyToggleDay = useCallback((day) => {
    if (submitting.current) return;
    setWeeklySelectedDays((previous) => (
      previous.includes(day) ? previous.filter((item) => item !== day) : [...previous, day]
    ));
  }, []);

  const onWeeklySelectAll = useCallback((selectAll) => {
    if (submitting.current || !weeklyPlan) return;
    setWeeklySelectedDays(selectAll ? weeklyPlan.map((post) => post.day) : []);
  }, [weeklyPlan]);

  const onCreateWeeklyDrafts = useCallback(async () => {
    if (submitting.current || !weeklyPlan?.length) return;
    const selected = weeklyPlan.filter((post) => weeklySelectedDays.includes(post.day));
    if (!selected.length) return;
    submitting.current = true;
    setStarting(true);
    setStartStatusClass("");
    try {
      const baseRequest = buildCampaignRequest(campaignDraft);
      const created = [];
      for (let index = 0; index < selected.length; index += 1) {
        setStartStatus(`Creating draft ${index + 1} of ${selected.length}…`);
        const payload = applyWeeklyPostToRequest(baseRequest, selected[index]);
        const data = await generateScript(payload);
        if (!data.job?.storyboard || !data.job.id) {
          throw new Error("A script draft could not be loaded. Please try again.");
        }
        created.push(data.job);
        setJobs((previous) => [data.job, ...previous.filter((job) => job.id !== data.job.id)]);
      }
      const first = created[0];
      setScriptJob(first);
      setScriptSetupId(first.id);
      setStoryboard(first.storyboard);
      setScriptDirty(false);
      setScriptErrors({});
      setScriptStatus("");
      setScriptLoadError("");
      setActiveJobId(first.id);
      setCampaignStep(5);
      setStartStatus("");
      setStartStatusClass("is-ok");
      navigate(`/dashboard/compose?draft=${encodeURIComponent(first.id)}`);
    } catch (err) {
      if (err.errors) setCampaignErrors(err.errors);
      setStartStatusClass("is-err");
      setStartStatus(String(err.message || err));
      if (err.status === 401) logout();
    } finally {
      submitting.current = false;
      setStarting(false);
    }
  }, [campaignDraft, logout, navigate, weeklyPlan, weeklySelectedDays]);

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
    // Auto-extend scene timing when a line needs a beat more time — don't block the user.
    const fitted = fitStoryboardSpeechCadence(storyboard);
    if (fitted !== storyboard) setStoryboard(fitted);
    const errors = validateStoryboard(fitted);
    setScriptErrors(errors);
    if (Object.keys(errors).length) return;
    submitting.current = true;
    setScriptBusy(action);
    setScriptStatusClass("");
    setScriptStatus(action === "render" ? "Starting your video…" : action === "save" ? "Saving your script…" : "Revising your script…");
    try {
      const payload = storyboardPayload(fitted);
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
      onPlanWeek,
      onCampaignBack,
      onCampaignEditStep,
      weeklyPlan,
      weeklySelectedDays,
      onWeeklyToggleDay,
      onWeeklySelectAll,
      onCreateWeeklyDrafts,
      hasSavedDraft,
      onRestoreDraft,
      onDiscardDraft,
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
      onPlanWeek,
      onCampaignBack,
      onCampaignEditStep,
      weeklyPlan,
      weeklySelectedDays,
      onWeeklyToggleDay,
      onWeeklySelectAll,
      onCreateWeeklyDrafts,
      hasSavedDraft,
      onRestoreDraft,
      onDiscardDraft,
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
