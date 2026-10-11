export default function Textarea({
  error = false,
  className = "",
  id,
  rows = 4,
  ...props
}) {
  const isInvalid = Boolean(error);
  return (
    <textarea
      id={id}
      rows={rows}
      className={`ui-textarea ${isInvalid ? "is-invalid" : ""} ${className}`.trim()}
      aria-invalid={isInvalid || undefined}
      {...props}
    />
  );
}
