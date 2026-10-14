function ProgressBar({ value, label }) {
  const boundedValue = Math.min(100, Math.max(0, value))

  return (
    <div className="progress-track">
      <div
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={boundedValue}
        className="progress-fill"
        role="progressbar"
        style={{ width: `${boundedValue}%` }}
      />
    </div>
  )
}

export default ProgressBar
