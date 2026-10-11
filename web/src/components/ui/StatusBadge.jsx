import Badge from "./Badge";

const STATUS_CONFIGS = {
  // Active pipeline stages
  queued: {
    label: "Queued",
    variant: "warning",
    dot: true,
    dotPulse: true,
  },
  generating: {
    label: "Generating",
    variant: "warning",
    dot: true,
    dotPulse: true,
  },
  collecting: {
    label: "Collecting",
    variant: "warning",
    dot: true,
    dotPulse: true,
  },
  posting: {
    label: "Publishing",
    variant: "warning",
    dot: true,
    dotPulse: true,
  },

  // Review & action stages
  awaiting_approval: {
    label: "Awaiting approval",
    variant: "primary",
    dot: true,
    dotPulse: false,
  },
  script_review: {
    label: "Script ready",
    variant: "primary",
    dot: true,
    dotPulse: false,
  },
  approved: {
    label: "Approved",
    variant: "success",
    dot: true,
    dotPulse: false,
  },

  // Completed & terminal
  posted: {
    label: "Published",
    variant: "success",
    dot: true,
    dotPulse: false,
  },
  failed: {
    label: "Failed",
    variant: "danger",
    dot: true,
    dotPulse: false,
  },
  denied: {
    label: "Denied",
    variant: "danger",
    dot: true,
    dotPulse: false,
  },
  cancelled: {
    label: "Cancelled",
    variant: "neutral",
    dot: true,
    dotPulse: false,
  },

  // System & Connection statuses
  online: {
    label: "Online",
    variant: "success",
    dot: true,
    dotPulse: false,
  },
  offline: {
    label: "Offline",
    variant: "warning",
    dot: true,
    dotPulse: false,
  },
  connecting: {
    label: "Connecting",
    variant: "info",
    dot: true,
    dotPulse: true,
  },
};

export default function StatusBadge({
  status,
  label,
  size = "sm",
  className = "",
  ...props
}) {
  const normalized = (status || "").toLowerCase().trim();
  const config = STATUS_CONFIGS[normalized] || {
    label: (status || "Unknown").replaceAll("_", " "),
    variant: "neutral",
    dot: true,
    dotPulse: false,
  };

  const displayText = label || config.label;

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot={config.dot}
      dotPulse={config.dotPulse}
      className={`ui-status-badge ui-status-${normalized} ${className}`.trim()}
      {...props}
    >
      {displayText}
    </Badge>
  );
}
