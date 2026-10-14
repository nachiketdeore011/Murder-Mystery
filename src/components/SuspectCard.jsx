function SuspectCard({ suspect, isSelected, onSelect }) {
  return (
    <button
      aria-pressed={isSelected}
      className={`suspect-card${isSelected ? ' is-selected' : ''}`}
      onClick={onSelect}
      type="button"
    >
      <span className="suspect-card-topline">
        <span aria-hidden="true" className="suspect-avatar">{suspect.initials}</span>
        <span className="suspect-identity">
          <span className="suspect-name">{suspect.name}</span>
          <span className="suspect-role">{suspect.role} · {suspect.age}</span>
        </span>
        <span aria-hidden="true" className="card-chevron">↗</span>
      </span>
      <span className="suspect-biography">{suspect.biography}</span>
      <span className="suspect-card-meta"><strong>Possible motive</strong>{suspect.motive}</span>
      <span className="suspect-card-meta"><strong>Stated alibi</strong>{suspect.alibi}</span>
      <span className="profile-action">View profile</span>
    </button>
  )
}

export default SuspectCard
