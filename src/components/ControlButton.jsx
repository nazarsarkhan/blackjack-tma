export default function ControlButton({
  children,
  onClick,
  disabled = false,
  variant = "primary"
}) {
  return (
    <button className={`control-button ${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
