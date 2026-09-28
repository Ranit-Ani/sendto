export default function BusyButton({ busy, busyLabel = 'Working…', children, className = '', ...rest }) {
  return (
    <button className={className} aria-busy={busy || undefined} disabled={busy || rest.disabled} {...rest}>
      {busy ? (
        <>
          <span className="btn__spinner"></span>
          <span>{busyLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
