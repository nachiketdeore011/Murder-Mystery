function CaseFilesPlaceholder({ caseFile, progress, discoveredEvidenceIds, onOpenCase }) {
  const discoveredCount = discoveredEvidenceIds?.size ?? discoveredEvidenceIds?.length ?? 0
  const hasSavedActivity = (progress?.journalEntries?.length ?? 0) > 0
    || Object.values(progress?.bookmarks || {}).some((ids) => Array.isArray(ids) && ids.length > 0)
  const status = progress?.completion
    ? 'Accusation recorded'
    : discoveredCount > 0 || hasSavedActivity ? 'In progress' : caseFile.status
  const actionLabel = progress?.completion
    ? 'Review completed case'
    : discoveredCount > 0 || hasSavedActivity ? 'Resume investigation' : 'Open investigation'

  return (
    <main className="placeholder-page">
      <p className="eyebrow">
        <span className="eyebrow-line" aria-hidden="true" />
        ARCHIVE / CASE RECORDS
      </p>
      <div className="placeholder-rule" aria-hidden="true" />
      <p className="section-kicker">CASE FILES</p>
      <h1 className="placeholder-title">One preliminary case is available.</h1>
      <p className="placeholder-copy">
        The archive currently contains one fictional case. Its status follows
        your saved investigation progress.
      </p>
      <section aria-label="Available preliminary case" className="archive-entry">
        <span className="archive-id">{caseFile.id.replace('CASE-', '')}</span>
        <span className="archive-entry-copy">
          <span className="archive-entry-title">{caseFile.title}</span>
          <span className="archive-entry-location">{caseFile.location} / Preliminary</span>
        </span>
        <span className="archive-entry-state">{status.toUpperCase()}</span>
      </section>
      <button className="button button-primary" onClick={onOpenCase} type="button">{actionLabel}</button>
    </main>
  )
}

export default CaseFilesPlaceholder
