const navItems = [
  { label: 'Home', view: 'home' },
  { label: 'Investigation', view: 'investigation' },
  { label: 'Simulation', view: 'simulation' },
  { label: 'Analytics', view: 'analytics' },
  { label: 'Case Files', view: 'case-files' },
  { label: 'About', view: 'about' },
]

function Navbar({ activeView, onNavigate }) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          aria-label="The Algorithmic Detective home"
          className="wordmark"
          onClick={() => onNavigate('home')}
          type="button"
        >
          <span className="wordmark-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="wordmark-copy">
            <span className="wordmark-title">THE ALGORITHMIC DETECTIVE</span>
            <span className="wordmark-subtitle">INVESTIGATION DIVISION</span>
          </span>
        </button>

        <nav aria-label="Main navigation" className="main-nav">
          {navItems.map(({ label, view }) => (
            <button
              aria-current={activeView === view ? 'page' : undefined}
              className={`nav-link${activeView === view ? ' is-active' : ''}`}
              key={view}
              onClick={() => onNavigate(view)}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default Navbar
