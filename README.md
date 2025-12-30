# BPPT - BPP Tree Viewer

A web and desktop application for viewing MCMC trees from [BPP](https://github.com/bpp/bpp) (Bayesian Phylogenetics and Phylogeography) analysis.

## Features

- **View species trees** from BPP MCMC output (`.mcmc.txt` files)
- **Embedded gene trees** within species tree "tubes" showing coalescent events
- **Multiple view modes**: Phylogram and Cladogram
- **Navigate posterior samples** with slider, keyboard, or direct input
- **Adjustable dimensions** with height and width sliders
- **Display theta values** (population size parameters) on branches

## Web Version

Try it online: **https://bpp.github.io/bppt/**

## Desktop Downloads

Download installers from [Releases](https://github.com/bpp/bppt/releases):

- **macOS**: `.dmg` (Intel and Apple Silicon)
- **Windows**: `.exe` installer
- **Linux**: `.AppImage`

## Usage

### Loading Species Trees

1. Click **"Choose File..."** to open a BPP MCMC output file (e.g., `mcmc_out.mcmc.txt`)
2. The first posterior sample will display automatically
3. Use the slider or arrow keys to navigate through samples

### Loading Gene Trees (Optional)

To visualize gene tree coalescences within species tree populations:

1. Load a species tree file first
2. Click **"Imap..."** to load the individual-to-species mapping file (e.g., `imap.txt`)
3. Click **"Gene Trees..."** to load gene tree files (e.g., `mcmc_out.gtree.L1`, `mcmc_out.gtree.L2`, etc.)
4. Select locus from the dropdown to switch between loci

### View Controls

- **View selector**: Switch between Phylogram (branch lengths proportional) and Cladogram views
- **Show θ checkbox**: Toggle display of theta values on branches
- **Height slider**: Adjust tree height (tips fixed at top, root extends downward)
- **Width slider**: Adjust tree width (species tubes scale proportionally)

### Navigation

- **Slider**: Drag to jump to any posterior sample
- **◀ / ▶ buttons**: Previous/next sample
- **Arrow keys**: Left/Right for previous/next
- **Page Up/Down**: Jump 100 samples
- **Home/End**: Jump to first/last sample
- **Direct input**: Type a sample number and press Enter

## Input File Formats

### Species Tree File (`.mcmc.txt`)

BPP MCMC output containing Newick trees with theta annotations:

```
((A:0.001,B:0.001):0.002,(C:0.001,D:0.001):0.002):0.003 #0.05 [theta values...]
```

### Gene Tree Files (`.gtree.L*`)

BPP gene tree output with individual labels in `Species^individual` format:

```
((A^a1:0.0001,A^a2:0.0001):0.001,(B^b1:0.0002,B^b2:0.0002):0.001):0.002; [TH=0.003]
```

### Imap File

Tab-separated file mapping individuals to species:

```
a1	A
a2	A
b1	B
b2	B
```

## Building from Source

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build web version
npm run build

# Build Electron app for current platform
npm run package
```

## License

MIT
