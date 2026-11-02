# Task brief — a playable simulation of CASE-001

Written for myself, to be executed in this repository. The goal is not a new game:
it is a **simulation of an existing playthrough** that a reader can step through,
so they understand what the game asks of them before they invest in the real one.

## Why

The investigation page is dense and the case file is deliberately cautious
("these are reported accounts", "none establishes guilt"). A new player can read
the whole page and still not know what a *successful* session looks like: which
rooms matter, in what order, which clues carry the reconstruction, and where the
algorithms sit in the middle of it.

The guided tour explains the sections. Nothing yet shows the **shape of a
playthrough** from the incident report to a confirmed accusation.

## What to build

A simulation view that replays CASE-001 step by step.

1. **Derive the playthrough from the real data.** Import the case file, the
   configured solution, and the existing algorithms (`createGraphFromLocations`
   + `dijkstra`, `createClueSearchIndex`, `rankSuspects`, `evaluateTheory`,
   `createEvidenceRelationshipNetwork`, `evaluateAccusation`). Every number the
   simulation shows must be computed, not narrated: real Dijkstra costs, real
   Trie prefix matches, real ranking scores, real deduction findings, and a real
   accusation evaluated by the same engine the game uses. No hardcoded verdicts
   and no duplicate algorithm logic.
2. **Be honest about what is scripted.** The route follows the configured
   reconstruction so a reader can see one coherent solution. The UI must say so,
   and must not imply a player could know this in advance.
3. **Keep the game's voice.** Clue (not record), sealed / filed-in, "follow-up
   lead, not guilt", the same caution the case file uses.
4. **Two decision points, so it is playable, not just watchable.** The reader
   chooses the first room to enter and, at the end, names a suspect and cites
   clues. Both choices are scored by the real algorithms, and a wrong accusation
   gets the engine's own feedback rather than a scripted scolding.
5. **Link to the real thing.** Every step names the Investigation page section
   that does the work, and can jump there.

## Constraints

- No new dependencies. React + Vite only.
- No changes to the save format, and no writes to player progress. The
  simulation is a read-only walkthrough.
- Do not fork algorithm logic into the simulation module; call the tested modules.
- Follow the existing style: no semicolons, single quotes, arrow functions,
  named exports for helpers plus a default export for the component, props
  destructured alphabetically.
- Accessibility: real buttons, an ordered step list, `aria-current="step"`,
  a polite live region for step changes, visible focus, progressbar semantics
  reused from the existing component.
- Tests: the step list must only name sections that exist on the Investigation
  page, the route must be monotonic in discovered clues, and the accusation step
  must actually solve the case through `evaluateAccusation`.

## Definition of done

- `npm test` passes with the new tests, and `npm run build` succeeds.
- The simulation is reachable from the navigation and from the home page.
- A reader can walk the whole case in a few clicks and then open the real
  investigation from any step.
