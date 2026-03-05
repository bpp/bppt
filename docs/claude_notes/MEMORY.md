# BPPT Project Memory

## Key Lessons

### BPP Output Precision
- BPP writes branch lengths with 6 decimal places (`%.6f`), creating non-ultrametric discrepancies of exactly `1e-6` in ~42% of species trees
- Any floating-point comparison on species tree ages needs epsilon >= `2e-6`
- See `src/core/genetree-parser.ts` EPS constant in `checkGeneTreeCompatibility()`

### Architecture Patterns
- UI toggles (Show θ, Show Labels) follow same pattern: checkbox in HTML, property + listener + handler in `main.ts`, conditional rendering in renderer
- `TreeStyle` interface in `tree-style.ts` holds all toggle state, propagated via `renderer.setStyle()`
- `FileIndexer` uses `skipFirstLine: true` for species trees (starting tree before MCMC), gene trees don't skip

### Test Data
- `testdata/frogs.*` — 4 species (K, C, L, H), 1000 MCMC iterations, 5 loci
- Gene tree format: `^individual:branchLength` (BPP style, no species prefix)
- Species mapped via Imap file
