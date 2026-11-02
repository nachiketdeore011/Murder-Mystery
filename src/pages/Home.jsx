import CaseBriefing from '../components/CaseBriefing.jsx'
import MansionIllustration from '../components/MansionIllustration.jsx'

function Home({ onOpenHowToPlay, onOpenSimulation, onStartInvestigation }) {
  return (
    <main className="home-page">
      <section aria-labelledby="hero-title" className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            EVERY CLUE HAS A CONNECTION
          </p>
          <h1 className="hero-title" id="hero-title">
            <span>Murder</span>
            <span className="hero-title-second-line">Mystery</span>
          </h1>
          <p className="hero-subtitle">The Algorithmic Detective</p>
          <p className="hero-description">
            A quiet night. Five suspects. One truth hidden in plain sight.
            Investigate the scene, uncover the relationships between people and
            evidence, and reconstruct what happened at Malhotra Mansion.
          </p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={onStartInvestigation} type="button">
              <span>Start Investigation</span>
              <span aria-hidden="true" className="button-arrow">↗</span>
            </button>
            <button className="button button-secondary" onClick={onOpenHowToPlay} type="button">
              How to Play
            </button>
            <button className="button button-secondary" onClick={onOpenSimulation} type="button">
              Run the Simulation
            </button>
          </div>
          <p className="hero-file-note">
            <span aria-hidden="true" className="file-note-dot" />
            CASE 001 <span aria-hidden="true">/</span> PRELIMINARY BRIEFING
          </p>
        </div>
        <div className="hero-art-column">
          <MansionIllustration />
        </div>
      </section>
      <CaseBriefing />
    </main>
  )
}

export default Home
