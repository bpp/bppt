/**
 * BPPT - BPP Tree Viewer
 * Main application entry point
 */

import { FileIndexer } from './core/file-indexer';
import { parseNewick } from './core/newick-parser';
import { TreeNode, getDepth } from './core/tree-types';
import { PhylogramRenderer } from './renderer/phylogram';
import { CladogramRenderer } from './renderer/cladogram';
import { EmbeddedGeneTreeRenderer } from './renderer/embedded-genetree';
import { TreeRenderer } from './renderer/tree-renderer';
import { parseGeneTree, parseImap } from './core/genetree-parser';
import { Imap } from './core/genetree-types';

class BPPTApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private indexer: FileIndexer | null = null;
  private currentTreeIndex: number = 0;
  private currentTree: TreeNode | null = null;
  private maxTreeDepth: number = 0; // For fixed scaling

  // Gene tree data - one indexer per locus
  private geneTreeIndexers: Map<string, FileIndexer> = new Map();
  private locusMaxHeights: Map<string, number> = new Map(); // Max height per locus
  private locusNames: string[] = [];
  private currentLocusIndex: number = 0;
  private imap: Imap = new Map();

  // Renderers
  private renderers: Map<string, TreeRenderer>;
  private currentRendererName: string = 'phylogram';

  // UI elements
  private fileInput: HTMLInputElement;
  private chooseFileBtn: HTMLButtonElement;
  private filenameSpan: HTMLElement;
  private noTreeMessage: HTMLElement;
  private slider: HTMLInputElement;
  private prevBtn: HTMLButtonElement;
  private nextBtn: HTMLButtonElement;
  private treeInput: HTMLInputElement;
  private treeTotal: HTMLElement;
  private viewSelect: HTMLSelectElement;
  private showThetaCheckbox: HTMLInputElement;

  // Gene tree UI elements
  private geneTreeControls: HTMLElement;
  private geneTreeInput: HTMLInputElement;
  private imapInput: HTMLInputElement;
  private chooseGeneTreeBtn: HTMLButtonElement;
  private chooseImapBtn: HTMLButtonElement;
  private geneTreeFilenameSpan: HTMLElement;
  private imapFilenameSpan: HTMLElement;
  private locusSelector: HTMLElement;
  private locusSelect: HTMLSelectElement;

  // Dimension control elements
  private heightSlider: HTMLInputElement;
  private heightValue: HTMLElement;
  private widthSlider: HTMLInputElement;
  private widthValue: HTMLElement;
  private canvasContainer: HTMLElement;

  constructor() {
    // Get canvas and context
    this.canvas = document.getElementById('tree-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Initialize renderers
    this.renderers = new Map();
    this.renderers.set('phylogram', new PhylogramRenderer(this.ctx));
    this.renderers.set('cladogram', new CladogramRenderer(this.ctx));
    this.renderers.set('embedded', new EmbeddedGeneTreeRenderer(this.ctx));

    // Get UI elements
    this.fileInput = document.getElementById('file-input') as HTMLInputElement;
    this.chooseFileBtn = document.getElementById('choose-file') as HTMLButtonElement;
    this.filenameSpan = document.getElementById('filename') as HTMLElement;
    this.noTreeMessage = document.getElementById('no-tree-message') as HTMLElement;
    this.slider = document.getElementById('tree-slider') as HTMLInputElement;
    this.prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
    this.nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
    this.treeInput = document.getElementById('tree-input') as HTMLInputElement;
    this.treeTotal = document.getElementById('tree-total') as HTMLElement;
    this.viewSelect = document.getElementById('view-select') as HTMLSelectElement;
    this.showThetaCheckbox = document.getElementById('show-theta') as HTMLInputElement;

    // Gene tree UI elements
    this.geneTreeControls = document.getElementById('gene-tree-controls') as HTMLElement;
    this.geneTreeInput = document.getElementById('genetree-input') as HTMLInputElement;
    this.imapInput = document.getElementById('imap-input') as HTMLInputElement;
    this.chooseGeneTreeBtn = document.getElementById('choose-genetree') as HTMLButtonElement;
    this.chooseImapBtn = document.getElementById('choose-imap') as HTMLButtonElement;
    this.geneTreeFilenameSpan = document.getElementById('genetree-filename') as HTMLElement;
    this.imapFilenameSpan = document.getElementById('imap-filename') as HTMLElement;
    this.locusSelector = document.getElementById('locus-selector') as HTMLElement;
    this.locusSelect = document.getElementById('locus-select') as HTMLSelectElement;

    // Dimension control elements
    this.heightSlider = document.getElementById('height-slider') as HTMLInputElement;
    this.heightValue = document.getElementById('height-value') as HTMLElement;
    this.widthSlider = document.getElementById('width-slider') as HTMLInputElement;
    this.widthValue = document.getElementById('width-value') as HTMLElement;
    this.canvasContainer = document.getElementById('canvas-container') as HTMLElement;

    this.setupEventListeners();
    this.resizeCanvas();
    this.render();
  }

  private setupEventListeners(): void {
    // File selection
    this.chooseFileBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => this.handleFileSelect());

    // Gene tree file selection
    this.chooseGeneTreeBtn.addEventListener('click', () => this.geneTreeInput.click());
    this.geneTreeInput.addEventListener('change', () => this.handleGeneTreeSelect());
    this.chooseImapBtn.addEventListener('click', () => this.imapInput.click());
    this.imapInput.addEventListener('change', () => this.handleImapSelect());
    this.locusSelect.addEventListener('change', () => this.handleLocusChange());

    // Navigation
    this.slider.addEventListener('input', () => this.handleSliderChange());
    this.prevBtn.addEventListener('click', () => this.prevTree());
    this.nextBtn.addEventListener('click', () => this.nextTree());
    this.treeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleTreeInputSubmit();
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => this.handleKeyboard(e));

    // View controls
    this.viewSelect.addEventListener('change', () => this.handleViewChange());
    this.showThetaCheckbox.addEventListener('change', () => this.handleThetaToggle());

    // Dimension sliders
    this.heightSlider.addEventListener('input', () => this.handleHeightChange());
    this.widthSlider.addEventListener('input', () => this.handleWidthChange());

    // Canvas resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this.render();
    });
  }

  private resizeCanvas(): void {
    // Set canvas dimensions from sliders
    const sliderWidth = parseInt(this.widthSlider.value, 10);
    const sliderHeight = parseInt(this.heightSlider.value, 10);
    this.canvas.width = sliderWidth;
    this.canvas.height = sliderHeight;
  }

  private async handleFileSelect(): Promise<void> {
    const file = this.fileInput.files?.[0];
    if (!file) return;

    try {
      this.filenameSpan.textContent = 'Indexing...';
      this.disableNavigation();

      // Create indexer and index the file
      // Skip first line as bpp outputs the starting tree before MCMC samples
      this.indexer = new FileIndexer(file, { skipFirstLine: true });
      await this.indexer.index((progress) => {
        this.filenameSpan.textContent = `Indexing... ${progress.indexed.toLocaleString()} trees`;
      });

      const treeCount = this.indexer.getTreeCount();

      if (treeCount === 0) {
        alert('No trees found in file');
        this.filenameSpan.textContent = 'No file selected';
        return;
      }

      // Find maximum tree depth for fixed scaling
      this.filenameSpan.textContent = 'Calculating scale...';
      this.maxTreeDepth = await this.findMaxTreeDepth();

      // Update phylogram renderer with fixed scale
      const phylogram = this.renderers.get('phylogram') as PhylogramRenderer;
      if (phylogram) {
        phylogram.setFixedScale(this.maxTreeDepth);
      }

      // Update UI
      this.filenameSpan.textContent = file.name;
      this.slider.min = '0';
      this.slider.max = String(treeCount - 1);
      this.slider.value = '0';
      this.currentTreeIndex = 0;

      // Show gene tree controls now that species tree is loaded
      this.geneTreeControls.style.display = 'flex';

      this.enableNavigation();
      await this.displayCurrentTree();

    } catch (error) {
      console.error('Failed to load file:', error);
      alert(`Failed to load file: ${error}`);
      this.filenameSpan.textContent = 'No file selected';
    }
  }

  private async findMaxTreeDepth(): Promise<number> {
    if (!this.indexer) return 0;

    const treeCount = this.indexer.getTreeCount();
    let maxDepth = 0;

    // Sample a fixed number of trees spread across the file
    // 200 samples is enough to get a good estimate of max depth
    const sampleCount = Math.min(200, treeCount);
    const step = Math.max(1, Math.floor(treeCount / sampleCount));

    // Collect sample indices
    const sampleIndices: number[] = [];
    for (let i = 0; i < treeCount; i += step) {
      sampleIndices.push(i);
    }

    // Fetch and parse in batches of 50 for better performance
    const batchSize = 50;
    for (let b = 0; b < sampleIndices.length; b += batchSize) {
      const batch = sampleIndices.slice(b, b + batchSize);
      const promises = batch.map(i => this.indexer!.getTree(i));
      const trees = await Promise.all(promises);

      for (const newickStr of trees) {
        const tree = parseNewick(newickStr);
        if (tree) {
          const depth = getDepth(tree);
          if (depth > maxDepth) {
            maxDepth = depth;
          }
        }
      }
    }

    // Add 10% buffer since we're sampling
    if (sampleCount < treeCount) {
      maxDepth *= 1.1;
    }

    return maxDepth;
  }

  /**
   * Find the maximum gene tree height for each locus.
   * Uses the TH= annotation in the gene tree strings for efficiency.
   * Stores results in locusMaxHeights map.
   */
  private async findMaxGeneTreeHeights(): Promise<void> {
    this.locusMaxHeights.clear();

    for (const locusName of this.locusNames) {
      const indexer = this.geneTreeIndexers.get(locusName);
      if (!indexer) continue;

      let maxHeight = 0;
      const treeCount = indexer.getTreeCount();
      // Sample up to 100 trees per locus for accuracy
      const sampleCount = Math.min(100, treeCount);
      const step = Math.max(1, Math.floor(treeCount / sampleCount));

      for (let i = 0; i < treeCount; i += step) {
        const treeStr = await indexer.getTree(i);
        // Extract TH= value from annotation
        const match = treeStr.match(/\[TH=([0-9.]+)/);
        if (match) {
          const height = parseFloat(match[1]);
          if (height > maxHeight) {
            maxHeight = height;
          }
        }
      }

      // Add 5% buffer and store
      this.locusMaxHeights.set(locusName, maxHeight * 1.05);
    }
  }

  /**
   * Update the embedded renderer's fixed scale for the current locus.
   */
  private updateEmbeddedScale(): void {
    const embeddedRenderer = this.renderers.get('embedded') as EmbeddedGeneTreeRenderer;
    if (!embeddedRenderer) return;

    const locusName = this.locusNames[this.currentLocusIndex];
    const maxHeight = this.locusMaxHeights.get(locusName);
    if (maxHeight && maxHeight > 0) {
      embeddedRenderer.setFixedScale(maxHeight);
    }
  }

  private async displayCurrentTree(): Promise<void> {
    if (!this.indexer) return;

    const treeCount = this.indexer.getTreeCount();
    const newickStr = await this.indexer.getTree(this.currentTreeIndex);

    this.currentTree = parseNewick(newickStr);

    // Update UI
    this.slider.value = String(this.currentTreeIndex);
    this.treeInput.value = (this.currentTreeIndex + 1).toLocaleString();
    this.treeTotal.textContent = `of ${treeCount.toLocaleString()}`;

    // Hide "no tree" message
    this.noTreeMessage.classList.add('hidden');

    // Update gene tree for this iteration if in embedded mode
    if (this.currentRendererName === 'embedded' && this.locusNames.length > 0) {
      await this.updateEmbeddedRenderer();
    }

    this.render();
  }

  private render(): void {
    const renderer = this.renderers.get(this.currentRendererName);
    if (renderer) {
      renderer.render(this.currentTree, this.canvas.width, this.canvas.height);
    }
  }

  private handleSliderChange(): void {
    const newIndex = parseInt(this.slider.value, 10);
    if (newIndex !== this.currentTreeIndex) {
      this.currentTreeIndex = newIndex;
      this.displayCurrentTree();
    }
  }

  private handleTreeInputSubmit(): void {
    const value = this.treeInput.value.replace(/,/g, '');
    const treeNum = parseInt(value, 10);
    if (!isNaN(treeNum) && this.indexer) {
      const index = Math.max(0, Math.min(treeNum - 1, this.indexer.getTreeCount() - 1));
      if (index !== this.currentTreeIndex) {
        this.currentTreeIndex = index;
        this.displayCurrentTree();
      }
    }
  }

  private prevTree(): void {
    if (this.currentTreeIndex > 0) {
      this.currentTreeIndex--;
      this.displayCurrentTree();
    }
  }

  private nextTree(): void {
    if (this.indexer && this.currentTreeIndex < this.indexer.getTreeCount() - 1) {
      this.currentTreeIndex++;
      this.displayCurrentTree();
    }
  }

  private gotoTree(index: number): void {
    if (!this.indexer) return;
    const treeCount = this.indexer.getTreeCount();
    index = Math.max(0, Math.min(index, treeCount - 1));
    if (index !== this.currentTreeIndex) {
      this.currentTreeIndex = index;
      this.displayCurrentTree();
    }
  }

  private handleKeyboard(e: KeyboardEvent): void {
    // Don't handle if typing in input
    if (e.target === this.treeInput) return;

    if (!this.indexer) return;

    switch (e.key) {
      case 'ArrowLeft':
        this.prevTree();
        break;
      case 'ArrowRight':
        this.nextTree();
        break;
      case 'Home':
        this.gotoTree(0);
        break;
      case 'End':
        this.gotoTree(this.indexer.getTreeCount() - 1);
        break;
      case 'PageUp':
        this.gotoTree(this.currentTreeIndex - 100);
        break;
      case 'PageDown':
        this.gotoTree(this.currentTreeIndex + 100);
        break;
    }
  }

  private async handleViewChange(): Promise<void> {
    this.currentRendererName = this.viewSelect.value;

    // Update gene tree for current iteration when switching to embedded view
    if (this.currentRendererName === 'embedded' && this.locusNames.length > 0) {
      await this.updateEmbeddedRenderer();
    }

    this.render();
  }

  private handleThetaToggle(): void {
    const showTheta = this.showThetaCheckbox.checked;
    for (const renderer of this.renderers.values()) {
      renderer.setStyle({ showTheta });
    }
    this.render();
  }

  private handleHeightChange(): void {
    const height = parseInt(this.heightSlider.value, 10);
    this.heightValue.textContent = `${height}px`;
    // Canvas height changes, container stays fixed - creates scrollable content
    this.resizeCanvas();
    this.render();
  }

  private handleWidthChange(): void {
    const width = parseInt(this.widthSlider.value, 10);
    this.widthValue.textContent = `${width}px`;
    // Canvas width changes, container stays fixed - creates scrollable content
    this.resizeCanvas();
    this.render();
  }

  private async handleGeneTreeSelect(): Promise<void> {
    const files = this.geneTreeInput.files;
    if (!files || files.length === 0) return;

    try {
      this.geneTreeFilenameSpan.textContent = 'Indexing...';
      this.geneTreeIndexers.clear();
      this.locusNames = [];

      // Index each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Extract locus name from filename (e.g., "out.gtree.L1" -> "L1")
        const match = file.name.match(/[._](L\d+|locus\d+)/i);
        let locusName = match ? match[1].toUpperCase() : `L${i + 1}`;

        // Ensure unique locus names
        while (this.geneTreeIndexers.has(locusName)) {
          locusName = `${locusName}_dup`;
        }

        const indexer = new FileIndexer(file);
        await indexer.index();

        this.geneTreeIndexers.set(locusName, indexer);
        this.locusNames.push(locusName);
      }

      // Sort locus names naturally (L1, L2, L10 not L1, L10, L2)
      this.locusNames.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
      });

      if (this.locusNames.length === 0) {
        this.geneTreeFilenameSpan.textContent = 'No loci found';
        return;
      }

      // Populate locus selector
      this.locusSelect.innerHTML = '';
      for (const name of this.locusNames) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        this.locusSelect.appendChild(option);
      }
      this.currentLocusIndex = 0;
      this.locusSelector.style.display = 'flex';

      this.geneTreeFilenameSpan.textContent = `Calculating scale...`;

      // Find max gene tree height for each locus (for per-locus fixed scaling)
      await this.findMaxGeneTreeHeights();

      // Set fixed scale for current locus
      this.updateEmbeddedScale();

      this.geneTreeFilenameSpan.textContent = `(${this.locusNames.length} loci)`;

      // Add embedded option to view selector if not present
      if (!this.viewSelect.querySelector('option[value="embedded"]')) {
        const embeddedOption = document.createElement('option');
        embeddedOption.value = 'embedded';
        embeddedOption.textContent = 'Embedded Gene Tree';
        this.viewSelect.appendChild(embeddedOption);
      }

      // Auto-switch to embedded view
      this.viewSelect.value = 'embedded';
      this.currentRendererName = 'embedded';

      // Update display with current species tree iteration
      await this.updateEmbeddedRenderer();
      this.render();

    } catch (error) {
      console.error('Failed to load gene trees:', error);
      this.geneTreeFilenameSpan.textContent = 'Error loading';
    }
  }

  private async handleLocusChange(): Promise<void> {
    const selectedLocus = this.locusSelect.value;
    this.currentLocusIndex = this.locusNames.indexOf(selectedLocus);
    // Update scale for new locus
    this.updateEmbeddedScale();
    await this.updateEmbeddedRenderer();
    this.render();
  }

  private async handleImapSelect(): Promise<void> {
    const file = this.imapInput.files?.[0];
    if (!file) return;

    try {
      this.imapFilenameSpan.textContent = 'Loading...';

      const content = await file.text();
      this.imap = parseImap(content);

      if (this.imap.size === 0) {
        this.imapFilenameSpan.textContent = 'No mappings found';
        return;
      }

      this.imapFilenameSpan.textContent = `(${this.imap.size})`;

      // Update the embedded renderer with the imap
      await this.updateEmbeddedRenderer();
      this.render();

    } catch (error) {
      console.error('Failed to load imap:', error);
      this.imapFilenameSpan.textContent = 'Error loading';
    }
  }

  private async updateEmbeddedRenderer(): Promise<void> {
    const embeddedRenderer = this.renderers.get('embedded') as EmbeddedGeneTreeRenderer;
    if (!embeddedRenderer) return;

    embeddedRenderer.setImap(this.imap);

    // Get gene tree for current locus and current species tree iteration
    if (this.locusNames.length > 0 && this.currentLocusIndex < this.locusNames.length) {
      const locusName = this.locusNames[this.currentLocusIndex];
      const indexer = this.geneTreeIndexers.get(locusName);

      if (indexer && this.currentTreeIndex < indexer.getTreeCount()) {
        try {
          const geneTreeStr = await indexer.getTree(this.currentTreeIndex);
          const geneTree = parseGeneTree(geneTreeStr, this.imap);
          embeddedRenderer.setGeneTree(geneTree);
        } catch (error) {
          console.error('Failed to load gene tree:', error);
          embeddedRenderer.setGeneTree(null);
        }
      } else {
        embeddedRenderer.setGeneTree(null);
      }
    } else {
      embeddedRenderer.setGeneTree(null);
    }
  }

  private enableNavigation(): void {
    this.slider.disabled = false;
    this.prevBtn.disabled = false;
    this.nextBtn.disabled = false;
    this.treeInput.disabled = false;
  }

  private disableNavigation(): void {
    this.slider.disabled = true;
    this.prevBtn.disabled = true;
    this.nextBtn.disabled = true;
    this.treeInput.disabled = true;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new BPPTApp();
});
