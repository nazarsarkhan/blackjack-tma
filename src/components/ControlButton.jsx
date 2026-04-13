export default function ControlButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  type = "button",
  wide = false
}) {
  return (
    <button
      className={`control-button ${variant}${wide ? " wide" : ""}`}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
}
