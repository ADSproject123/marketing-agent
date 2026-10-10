import {
  NODE_H,
  NODE_ORDER,
  NODE_W,
  STEPS,
  activeEdgeKeys,
  computeLayout,
  nodeStateMap,
} from "../flow";

const INK = "#15202b";
const TEAL = "#0f766e";
const MUTED = "#8aa0b2";
const DANGER = "#b42318";
const OK = "#1b7a4a";

function fillFor(state) {
  if (state === "current") return "rgba(15,118,110,0.16)";
  if (state === "done") return "rgba(27,122,74,0.1)";
  if (state === "failed") return "rgba(180,35,24,0.12)";
  return "rgba(255,255,255,0.85)";
}

function strokeFor(state) {
  if (state === "current") return TEAL;
  if (state === "done") return OK;
  if (state === "failed") return DANGER;
  return INK;
}

export default function FlowDiagram({ job }) {
  const layout = computeLayout();
  const states = nodeStateMap(job);
  const activeEdges = activeEdgeKeys(job);

  return (
    <div className="flow-scroll">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        width={layout.width}
        height={layout.height}
        role="img"
        aria-label="Live marketing agent pipeline"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={MUTED} />
          </marker>
          <marker
            id="arrowActive"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={TEAL} />
          </marker>
        </defs>

        {layout.edges.map((edge) => {
          const key = `${edge.from}->${edge.to}`;
          const isActive = activeEdges.has(key);
          const midX = (edge.sourceX + edge.targetX) / 2;
          const d = `M ${edge.sourceX} ${edge.sourceY} C ${midX} ${edge.sourceY}, ${midX} ${edge.targetY}, ${edge.targetX} ${edge.targetY}`;
          return (
            <g key={key}>
              <path
                className={`flow-edge ${isActive ? "is-active" : ""}`}
                d={d}
                fill="none"
                stroke={isActive ? TEAL : MUTED}
                strokeWidth={isActive ? 2.6 : 1.4}
                strokeDasharray={isActive ? "8 6" : "0"}
                opacity={isActive ? 1 : 0.28}
                markerEnd={`url(#${isActive ? "arrowActive" : "arrow"})`}
              />
              {edge.label ? (
                <text
                  x={midX}
                  y={(edge.sourceY + edge.targetY) / 2 - 10}
                  textAnchor="middle"
                  fill={isActive ? TEAL : MUTED}
                  fontSize="11"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {NODE_ORDER.map((id) => {
          const n = layout.nodes[id];
          const step = STEPS[id];
          const state = states[id];
          const opacity = state === "idle" ? 0.38 : state === "pending" ? 0.55 : 1;
          const sub =
            state === "current"
              ? "in progress"
              : state === "done"
                ? "done"
                : state === "failed"
                  ? "failed"
                  : step.subtitle.length > 18
                    ? `${step.subtitle.slice(0, 16)}…`
                    : step.subtitle;
          const labelColor =
            state === "failed" ? DANGER : state === "current" ? TEAL : "#3a4a5a";

          return (
            <g
              key={id}
              className={`flow-node is-${state}`}
              transform={`translate(${n.x}, ${n.y})`}
              opacity={opacity}
            >
              {state === "current" ? (
                <rect
                  className="flow-pulse"
                  width={NODE_W}
                  height={NODE_H}
                  rx="10"
                  fill="none"
                  stroke={TEAL}
                  strokeWidth="2"
                />
              ) : null}
              <rect
                width={NODE_W}
                height={NODE_H}
                rx="10"
                fill={fillFor(state)}
                stroke={strokeFor(state)}
                strokeWidth={state === "current" || state === "done" ? 2.4 : 1.2}
              />
              <text
                x={NODE_W / 2}
                y="24"
                textAnchor="middle"
                fill={INK}
                fontSize="13"
                fontWeight="600"
                fontFamily="Figtree, sans-serif"
              >
                {step.title}
              </text>
              <text
                x={NODE_W / 2}
                y="42"
                textAnchor="middle"
                fill={labelColor}
                fontSize="11"
                fontFamily="IBM Plex Mono, monospace"
              >
                {sub}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
