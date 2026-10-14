function About() {
  return (
    <main className="placeholder-page about-page">
      <p className="eyebrow">
        <span className="eyebrow-line" aria-hidden="true" />
        A DETECTIVE GAME BUILT ON LOGIC
      </p>
      <div className="placeholder-rule" aria-hidden="true" />
      <p className="section-kicker">ABOUT THE PROJECT</p>
      <h1 className="placeholder-title">Learn to follow the evidence.</h1>
      <p className="placeholder-copy">
        <em>Murder Mystery: The Algorithmic Detective</em> is a fictional
        investigation game created as a college Data Structures and Algorithms
        mini-project. The Malhotra Mansion case lets players explore how
        different structures organize and connect the same investigation data.
      </p>
      <ul aria-label="DSA concepts in the project" className="learning-topics">
        <li>Graph traversal with BFS and DFS</li>
        <li>Weighted shortest paths with Dijkstra</li>
        <li>Hash tables for direct lookup</li>
        <li>BST search and traversals</li>
        <li>B+ Tree evidence range indexing</li>
        <li>Trie prefix search</li>
      </ul>
      <p className="about-note">
        CASE-001 also includes explainable suspect-priority and rule-based
        deduction tools, a persistent investigation journal, and a final
        accusation flow. Scores and deductions help organize discovered facts;
        they are not probabilities of guilt. Case records are fictional, and
        the DSA explorers are educational in-memory implementations.
      </p>
    </main>
  )
}

export default About
