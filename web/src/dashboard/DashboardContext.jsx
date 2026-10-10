import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchHealth, fetchJobs, startJob } from "../api";
import { useAuth } from "../auth";
import { ACTIVE_STATUSES, pickDefaultJob } from "../flow";
import { templateById } from "../templates";

const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [healthLabel, setHealthLabel] = useState("checking…");
  const [online, setOnline] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsError, setJobsError] = useState("");
  const [activeJobId, setActiveJobId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startStatus, setStartStatus] = useState("");
  const [startStatusClass, setStartStatusClass] = useState("");

  const [templateId, setTemplateId] = useState("weekend_sale");
  const [brief, setBrief] = useState(() => templateById("weekend_sale").brief);
  const [urls, setUrls] = useState("");
  const [notes, setNotes] = useState(() => templateById("weekend_sale").notes);

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

  useEffect(() => {
    loadHealth();
    loadJobs();
    const healthTimer = setInterval(loadHealth, 15000);
    return () => clearInterval(healthTimer);
  }, [loadHealth, loadJobs]);

  useEffect(() => {
    const ms = activeJob && ACTIVE_STATUSES.has(activeJob.status) ? 2500 : 8000;
    const timer = setInterval(() => loadJobs(), ms);
    return () => clearInterval(timer);
  }, [activeJob, loadJobs]);

  const onTemplateChange = useCallback(
    (id) => {
      setTemplateId(id);
      const tpl = templateById(id);
      if (tpl.brief) setBrief(tpl.brief);
      if (tpl.notes) setNotes(tpl.notes);
      if (id === "auto_gemini") {
        setBrief("");
        setNotes(tpl.notes);
      }
      if (id === "" && !brief) setBrief("");
    },
    [brief]
  );

  const onStart = useCallback(
    async (ev) => {
      ev.preventDefault();
      setStarting(true);
      setStartStatusClass("");
      setStartStatus("Starting…");
      try {
        const urlList = urls
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean);
        const data = await startJob({
          brief: brief.trim(),
          urls: urlList,
          notes: notes.trim() || null,
          template: templateId || "",
        });
        setStartStatusClass("is-ok");
        setStartStatus(data.message || "Started — check Telegram.");
        if (data.job?.id) {
          setActiveJobId(data.job.id);
          await loadJobs(data.job.id);
        } else {
          await loadJobs();
        }
        navigate("/dashboard/pipeline");
      } catch (err) {
        setStartStatusClass("is-err");
        setStartStatus(String(err.message || err));
        if (err.status === 401) logout();
      } finally {
        setStarting(false);
      }
    },
    [urls, brief, notes, templateId, loadJobs, navigate, logout]
  );

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
      templateId,
      brief,
      urls,
      notes,
      starting,
      startStatus,
      startStatusClass,
      onTemplateChange,
      setBrief,
      setUrls,
      setNotes,
      onStart,
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
      templateId,
      brief,
      urls,
      notes,
      starting,
      startStatus,
      startStatusClass,
      onTemplateChange,
      onStart,
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
