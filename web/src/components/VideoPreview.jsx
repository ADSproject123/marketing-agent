import { useEffect, useState } from "react";
import { fetchPrivateMedia } from "../api";
import { notify } from "../toast";
import Icon from "./Icon";
import { Button, Spinner } from "./ui";

export default function VideoPreview({ job }) {
  const [attempt, setAttempt] = useState(1);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!attempt || !job?.video_url) return undefined;
    const controller = new AbortController();
    let objectUrl = "";
    setLoading(true);
    setError("");

    fetchPrivateMedia(job.video_url, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const msg = err.message || "Could not load video preview.";
        setError(msg);
        setLoading(false);
        notify.error(msg);
      });

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, job?.video_url, job?.id]);

  if (!job?.video_url) {
    return (
      <div className="video-empty-frame">
        <div className="video-empty-inner">
          <span className="video-empty-icon" aria-hidden="true">
            <Icon name="video" size={24} />
          </span>
          <p className="video-empty-title">No video file available yet</p>
          <span className="video-empty-sub">
            The vertical video will render here once generation completes.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="video-preview-showcase">
      <div className="video-screen-container">
        {loading ? (
          <div className="video-player-status">
            <Spinner size={26} stroke={2.5} />
            <p>Loading video preview…</p>
          </div>
        ) : error ? (
          <div className="video-player-status is-error">
            <Icon name="alert" size={24} />
            <p>{error}</p>
            <Button
              variant="ghost"
              size="sm"
              icon="refresh"
              onClick={() => {
                setError("");
                setAttempt((val) => val + 1);
              }}
            >
              Retry loading
            </Button>
          </div>
        ) : (
          <video
            className="video-screen-media"
            src={url}
            controls
            playsInline
            preload="metadata"
            aria-label="Campaign vertical video"
          />
        )}
      </div>

      {url ? (
        <div className="video-action-row">
          <Button
            href={url}
            download={`campaign-${job.id.slice(0, 8)}.mp4`}
            variant="ghost"
            size="sm"
            icon="arrow-right"
            iconPosition="end"
          >
            Download MP4
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon="arrow-up-right"
            onClick={() => window.open(url, "_blank")}
          >
            Open in new tab
          </Button>
        </div>
      ) : null}
    </div>
  );
}
