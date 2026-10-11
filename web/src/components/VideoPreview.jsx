import { useEffect, useState } from "react";
import { fetchPrivateMedia } from "../api";
import { Alert, Button } from "./ui";

export default function VideoPreview({ job }) {
  const [attempt, setAttempt] = useState(0);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!attempt || !job.video_url) return undefined;
    const controller = new AbortController();
    let objectUrl = "";
    fetchPrivateMedia(job.video_url, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message || "Could not load this video.");
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, job.video_url]);

  if (!job.video_url) return null;
  const isLoading = attempt > 0 && !error && !url;

  return (
    <div className="ui-video-preview">
      {!url ? (
        <Button
          variant="ghost"
          size="sm"
          icon="play"
          loading={isLoading}
          loadingText="Loading video…"
          disabled={isLoading}
          onClick={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Preview video
        </Button>
      ) : (
        <>
          <video
            className="detail-video"
            src={url}
            controls
            playsInline
            preload="metadata"
            aria-label="Finished campaign video"
          />
          <a
            className="text-link detail-video-download"
            href={url}
            download={`campaign-${job.id.slice(0, 8)}.mp4`}
          >
            Download video
          </a>
        </>
      )}
      {error ? (
        <Alert tone="danger" className="mt-2">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}
