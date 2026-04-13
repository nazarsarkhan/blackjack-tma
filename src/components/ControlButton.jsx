export default function ControlButton({
  children,
  onClick,
  onTouchStart,
  disabled = false,
  variant = "primary",
  type = "button",
  wide = false
}) {
  return (
    <button
      className={`control-button ${variant}${wide ? " wide" : ""}`}
      onClick={onClick}
      onTouchStart={onTouchStart}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
}
