/**
 * Embedded Gene Tree Renderer
 * Draws gene tree lineages within species tree "tubes".
 * Shows coalescent events and migration between populations.
 */

import { GeneTreeNode, GeneTree, isGeneLeaf, getGeneLeaves, Imap } from '../core/genetree-types';
import { TreeNode, getLeaves as getSpeciesLeaves, getDepth as getSpeciesDepth } from '../core/tree-types';
import { TreeRenderer } from './tree-renderer';

interface SpeciesPosition {
  x: number;           // Center x position of the species tube
  width: number;       // Width of the tube (based on theta)
}

interface PopulationInfo {
  name: string;
  leftX: number;
  rightX: number;
  startTime: number;   // Time when this population starts (closer to tips)
  endTime: number;     // Time when this population ends (closer to root)
  species: Set<string>; // Which tip species are descended from this population
}

// Color palette for different populations
const POPULATION_COLORS = [
  { fill: 'rgba(66, 133, 244, 0.20)', stroke: 'rgba(66, 133, 244, 0.5)' },   // Blue
  { fill: 'rgba(234, 67, 53, 0.20)', stroke: 'rgba(234, 67, 53, 0.5)' },     // Red
  { fill: 'rgba(52, 168, 83, 0.20)', stroke: 'rgba(52, 168, 83, 0.5)' },     // Green
  { fill: 'rgba(251, 188, 4, 0.20)', stroke: 'rgba(251, 188, 4, 0.5)' },     // Yellow
  { fill: 'rgba(155, 89, 182, 0.20)', stroke: 'rgba(155, 89, 182, 0.5)' },   // Purple
  { fill: 'rgba(230, 126, 34, 0.20)', stroke: 'rgba(230, 126, 34, 0.5)' },   // Orange
  { fill: 'rgba(26, 188, 156, 0.20)', stroke: 'rgba(26, 188, 156, 0.5)' },   // Teal
  { fill: 'rgba(241, 196, 15, 0.20)', stroke: 'rgba(241, 196, 15, 0.5)' },   // Gold
];

export class EmbeddedGeneTreeRenderer extends TreeRenderer {
  private imap: Imap = new Map();
  private geneTree: GeneTree | null = null;
  private fixedScale: number | null = null;
  private populationColorIndex: Map<string, number> = new Map();
  private nextColorIndex: number = 0;
  private populations: PopulationInfo[] = [];

  getName(): string {
    return 'Embedded Gene Tree';
  }

  /**
   * Set a fixed scale based on max gene tree height.
   * All trees will be scaled relative to this value.
   */
  setFixedScale(maxHeight: number): void {
    this.fixedScale = maxHeight;
  }

  /**
   * Set the imap for species mapping.
   */
  setImap(imap: Imap): void {
    this.imap = imap;
  }

  /**
   * Set the gene tree to render.
   */
  setGeneTree(geneTree: GeneTree | null): void {
    this.geneTree = geneTree;
  }

  /**
   * Get color for a population, assigning new color if not seen before.
   */
  private getPopulationColor(populationName: string): { fill: string; stroke: string } {
    if (!this.populationColorIndex.has(populationName)) {
      this.populationColorIndex.set(populationName, this.nextColorIndex);
      this.nextColorIndex = (this.nextColorIndex + 1) % POPULATION_COLORS.length;
    }
    const idx = this.populationColorIndex.get(populationName)!;
    return POPULATION_COLORS[idx];
  }

  /**
   * Reset population colors for new tree.
   */
  private resetPopulationColors(): void {
    this.populationColorIndex.clear();
    this.nextColorIndex = 0;
  }

  /**
   * Render species tree with embedded gene tree.
   */
  render(speciesTree: TreeNode | null, width: number, height: number): void {
    this.clear(width, height);
    this.resetPopulationColors();

    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';

    if (!speciesTree) {
      this.drawNoTree(width, height);
      return;
    }

    if (width < 50 || height < 50) {
      return;
    }

    const speciesLeaves = getSpeciesLeaves(speciesTree);
    const nSpecies = speciesLeaves.length;

    if (nSpecies === 0) {
      return;
    }

    // Calculate dimensions
    const availableWidth = width - this.style.marginLeft - this.style.marginRight;
    const availableHeight = height - this.style.marginTop - this.style.marginBottom;

    // Use fixed scale if set, otherwise calculate from current tree
    let maxDepth: number;
    if (this.fixedScale !== null) {
      maxDepth = this.fixedScale;
    } else {
      // Fallback: use max of species and gene tree depth
      maxDepth = getSpeciesDepth(speciesTree) || 0.01;
      if (this.geneTree) {
        const geneDepth = this.getGeneTreeDepth(this.geneTree.root);
        maxDepth = Math.max(maxDepth, geneDepth);
      }
    }

    // Calculate species positions
    const speciesSpacing = availableWidth / Math.max(nSpecies - 1, 1);
    let xOffset = this.style.marginLeft;
    if (nSpecies === 1) {
      xOffset += availableWidth / 2;
    }

    const speciesPositions: Map<string, SpeciesPosition> = new Map();
    const maxTheta = this.getMaxTheta(speciesTree);
    // Tube width scales proportionally with available width (no fixed cap)
    // Use 60% of spacing between species for tube width
    const tubeWidth = Math.max(20, speciesSpacing * 0.6);

    // Inset species positions by half tube width so tubes don't extend past margins
    const halfTube = tubeWidth / 2;
    const insetXOffset = xOffset + halfTube;
    const insetSpacing = nSpecies > 1 ? (availableWidth - tubeWidth) / (nSpecies - 1) : 0;

    speciesLeaves.forEach((name, i) => {
      const x = nSpecies > 1 ? insetXOffset + i * insetSpacing : xOffset;
      speciesPositions.set(name, {
        x,
        width: tubeWidth
      });
    });

    // Y scale: root at bottom, tips at top (scaled by max depth)
    const yScale = availableHeight / maxDepth;
    const rootY = height - this.style.marginBottom;
    const tipY = this.style.marginTop;

    // Calculate species tree depth (total tree height = time at root)
    const speciesDepth = getSpeciesDepth(speciesTree);
    // The species tree root position (where ABCD population begins)
    const speciesRootY = rootY - (maxDepth - speciesDepth) * yScale;

    // Clear and rebuild population info
    this.populations = [];

    // Draw species tree tubes, starting from species root position
    // Pass speciesDepth as rootAge - we'll compute ages (time from tips) correctly
    const tubeResult = this.drawSpeciesTubes(speciesTree, speciesPositions, speciesRootY, tipY, yScale, speciesDepth);

    // Draw root population (ABCD) extending from speciesRootY to rootY (maxDepth)
    if (speciesRootY < rootY) {
      this.drawRootPopulation(tubeResult.leftX, tubeResult.rightX, speciesRootY, rootY);
      // Add root population info
      this.populations.push({
        name: 'root',
        leftX: tubeResult.leftX,
        rightX: tubeResult.rightX,
        startTime: speciesDepth,
        endTime: maxDepth,
        species: new Set(speciesLeaves)
      });
    }

    // Draw gene tree lineages if available
    if (this.geneTree) {
      this.drawGeneLineages(
        this.geneTree.root,
        speciesPositions,
        tipY,
        yScale
      );
    }

    // Draw species labels
    this.drawSpeciesLabels(speciesLeaves, speciesPositions, tipY);

    // Draw theta values on species tree
    if (this.style.showTheta) {
      this.drawThetaLabels(speciesTree, speciesPositions, speciesRootY, tipY, yScale);
    }

    // Draw time scale bar
    this.drawScaleBar(width, height, yScale, maxDepth, rootY);
  }

  /**
   * Get maximum theta value in the tree for scaling tube widths.
   */
  private getMaxTheta(node: TreeNode): number {
    let max = node.theta || 0;
    for (const child of node.children) {
      max = Math.max(max, this.getMaxTheta(child));
    }
    return max;
  }

  /**
   * Draw species tree as semi-transparent tubes with different colors per population.
   * Also builds population info for gene tree rendering.
   * @param nodeAge - age at this node (time from tips, where tips = 0)
   */
  private drawSpeciesTubes(
    node: TreeNode,
    positions: Map<string, SpeciesPosition>,
    parentY: number,
    tipY: number,
    yScale: number,
    nodeAge: number
  ): { leftX: number; rightX: number; nodeY: number; species: Set<string> } {
    const ctx = this.ctx;

    if (node.children.length === 0) {
      // Leaf node - draw vertical tube from parentY to tipY
      const pos = positions.get(node.name);
      if (!pos) return { leftX: 0, rightX: 0, nodeY: tipY, species: new Set() };

      const halfWidth = pos.width / 2;
      const colors = this.getPopulationColor(node.name);

      // Draw tube
      ctx.fillStyle = colors.fill;
      ctx.beginPath();
      ctx.moveTo(pos.x - halfWidth, parentY);
      ctx.lineTo(pos.x - halfWidth, tipY);
      ctx.lineTo(pos.x + halfWidth, tipY);
      ctx.lineTo(pos.x + halfWidth, parentY);
      ctx.closePath();
      ctx.fill();

      // Draw borders
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pos.x - halfWidth, parentY);
      ctx.lineTo(pos.x - halfWidth, tipY);
      ctx.moveTo(pos.x + halfWidth, parentY);
      ctx.lineTo(pos.x + halfWidth, tipY);
      ctx.stroke();

      // Add population info for this leaf species
      // Leaf population exists from time 0 (tips) to nodeAge (parent divergence)
      this.populations.push({
        name: node.name,
        leftX: pos.x - halfWidth,
        rightX: pos.x + halfWidth,
        startTime: 0,
        endTime: nodeAge,
        species: new Set([node.name])
      });

      return { leftX: pos.x - halfWidth, rightX: pos.x + halfWidth, nodeY: tipY, species: new Set([node.name]) };
    }

    // Internal node
    const nodeY = parentY - node.branchLength * yScale;

    // Recursively draw children first
    // Child age = nodeAge - node.branchLength (going down toward tips)
    // But wait - we need to pass the age at the child node, which is when children diverge
    // For internal nodes, the divergence happens at the node, so children see this node's age
    // Actually, we compute child ages based on their branch lengths from this node
    const childResults: { leftX: number; rightX: number; nodeY: number; species: Set<string> }[] = [];
    for (const child of node.children) {
      // Age at child = current nodeAge - child's branch length
      // But for leaves, their age should be 0
      // The child's branchLength is the time from child to this node
      // So child age = nodeAge - child.branchLength... but that's computing during recursion
      // Actually we should pass nodeAge - node.branchLength to get age at this internal node
      // Then children use their own branchLength
      const childAge = nodeAge - node.branchLength;
      const result = this.drawSpeciesTubes(child, positions, nodeY, tipY, yScale, childAge);
      childResults.push(result);
    }

    // Calculate this node's bounds
    const leftX = Math.min(...childResults.map(r => r.leftX));
    const rightX = Math.max(...childResults.map(r => r.rightX));

    // Merge species from children
    const species = new Set<string>();
    for (const result of childResults) {
      for (const s of result.species) {
        species.add(s);
      }
    }

    // Get color for this ancestral population
    const popName = node.name || `anc_${leftX}_${rightX}`;
    const colors = this.getPopulationColor(popName);

    // Draw vertical tube above this node (connecting to parent)
    ctx.fillStyle = colors.fill;
    ctx.beginPath();
    ctx.moveTo(leftX, parentY);
    ctx.lineTo(leftX, nodeY);
    ctx.lineTo(rightX, nodeY);
    ctx.lineTo(rightX, parentY);
    ctx.closePath();
    ctx.fill();

    // Draw borders
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftX, parentY);
    ctx.lineTo(leftX, nodeY);
    ctx.moveTo(rightX, parentY);
    ctx.lineTo(rightX, nodeY);
    ctx.stroke();

    // Draw horizontal bar at divergence point
    ctx.beginPath();
    ctx.moveTo(leftX, nodeY);
    ctx.lineTo(rightX, nodeY);
    ctx.stroke();

    // Add population info for this ancestral population
    // This population exists from childAge (when children diverge) to nodeAge (when this merges with sibling)
    const childAge = nodeAge - node.branchLength;
    this.populations.push({
      name: popName,
      leftX,
      rightX,
      startTime: childAge,
      endTime: nodeAge,
      species
    });

    return { leftX, rightX, nodeY, species };
  }

  /**
   * Draw the root population tube extending from species root to max depth.
   */
  private drawRootPopulation(leftX: number, rightX: number, topY: number, bottomY: number): void {
    const ctx = this.ctx;
    // Use a distinct color for the root population (gray/neutral)
    const colors = { fill: 'rgba(120, 120, 120, 0.15)', stroke: 'rgba(120, 120, 120, 0.5)' };

    // Draw tube
    ctx.fillStyle = colors.fill;
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(leftX, bottomY);
    ctx.lineTo(rightX, bottomY);
    ctx.lineTo(rightX, topY);
    ctx.closePath();
    ctx.fill();

    // Draw borders
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(leftX, bottomY);
    ctx.moveTo(rightX, topY);
    ctx.lineTo(rightX, bottomY);
    ctx.stroke();

    // Draw horizontal bar at top (where children diverge)
    ctx.beginPath();
    ctx.moveTo(leftX, topY);
    ctx.lineTo(rightX, topY);
    ctx.stroke();
  }

  /**
   * Draw time scale bar on the right side.
   */
  private drawScaleBar(
    canvasWidth: number,
    canvasHeight: number,
    yScale: number,
    maxDepth: number,
    rootY: number
  ): void {
    const ctx = this.ctx;

    // Position scale bar on the right
    const barX = canvasWidth - 50;
    const barTop = this.style.marginTop;
    const barBottom = rootY;

    // Calculate a nice round number for the scale
    const niceScale = this.getNiceScaleValue(maxDepth);
    const scaleHeight = niceScale * yScale;

    // Draw the scale bar (vertical line with ticks)
    ctx.strokeStyle = this.style.labelColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barBottom);
    ctx.lineTo(barX, barBottom - scaleHeight);
    ctx.stroke();

    // Draw end ticks
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(barX - 5, barBottom);
    ctx.lineTo(barX + 5, barBottom);
    ctx.moveTo(barX - 5, barBottom - scaleHeight);
    ctx.lineTo(barX + 5, barBottom - scaleHeight);
    ctx.stroke();

    // Draw scale label
    ctx.fillStyle = this.style.labelColor;
    ctx.font = 'bold 11px "Nunito Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.formatScaleValue(niceScale), barX, barBottom + 8);
  }

  /**
   * Get a nice round number for the scale bar.
   */
  private getNiceScaleValue(maxDepth: number): number {
    const target = maxDepth * 0.4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
    const normalized = target / magnitude;

    let nice: number;
    if (normalized < 1.5) nice = 1;
    else if (normalized < 3.5) nice = 2;
    else if (normalized < 7.5) nice = 5;
    else nice = 10;

    return nice * magnitude;
  }

  /**
   * Format scale value for display.
   */
  private formatScaleValue(value: number): string {
    if (value >= 0.01) return value.toFixed(3);
    else if (value >= 0.001) return value.toFixed(4);
    else return value.toExponential(1);
  }

  /**
   * Draw theta values on species tree populations.
   */
  private drawThetaLabels(
    node: TreeNode,
    positions: Map<string, SpeciesPosition>,
    parentY: number,
    tipY: number,
    yScale: number
  ): void {
    const ctx = this.ctx;
    ctx.fillStyle = this.style.thetaColor;
    ctx.font = this.style.thetaFont;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    if (node.children.length === 0) {
      // Leaf node
      const pos = positions.get(node.name);
      if (pos && node.theta !== null) {
        const midY = (parentY + tipY) / 2;
        ctx.fillText(`θ=${node.theta.toFixed(4)}`, pos.x + pos.width / 2 + 4, midY);
      }
      return;
    }

    // Internal node
    const nodeY = parentY - node.branchLength * yScale;

    // Draw theta for this internal node
    if (node.theta !== null) {
      // Get bounds from children positions
      const childXs: number[] = [];
      for (const child of node.children) {
        if (child.children.length === 0) {
          const pos = positions.get(child.name);
          if (pos) childXs.push(pos.x);
        } else {
          // For internal children, recursively get their center
          const centerX = this.getNodeCenterX(child, positions);
          childXs.push(centerX);
        }
      }
      const centerX = childXs.reduce((a, b) => a + b, 0) / childXs.length;
      const midY = (parentY + nodeY) / 2;
      ctx.fillText(`θ=${node.theta.toFixed(4)}`, centerX + 30, midY);
    }

    // Recurse to children
    for (const child of node.children) {
      this.drawThetaLabels(child, positions, nodeY, tipY, yScale);
    }
  }

  /**
   * Get center X position of a node.
   */
  private getNodeCenterX(node: TreeNode, positions: Map<string, SpeciesPosition>): number {
    if (node.children.length === 0) {
      const pos = positions.get(node.name);
      return pos ? pos.x : 0;
    }
    const childXs = node.children.map(c => this.getNodeCenterX(c, positions));
    return childXs.reduce((a, b) => a + b, 0) / childXs.length;
  }

  /**
   * Draw species labels at the top.
   */
  private drawSpeciesLabels(
    speciesLeaves: string[],
    positions: Map<string, SpeciesPosition>,
    tipY: number
  ): void {
    const ctx = this.ctx;
    ctx.fillStyle = this.style.labelColor;
    ctx.font = this.style.labelFontBold;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (const species of speciesLeaves) {
      const pos = positions.get(species);
      if (pos) {
        // Position species label well above individual tip labels
        ctx.fillText(species, pos.x, tipY - 28);
      }
    }
  }

  /**
   * Find the population that contains a set of species at a given time.
   */
  private findPopulationForSpecies(speciesSet: Set<string>, time: number): PopulationInfo | null {
    // Find smallest population that contains all species and is valid at this time
    let bestPop: PopulationInfo | null = null;
    let bestSize = Infinity;

    for (const pop of this.populations) {
      // Check if time is within this population's bounds
      if (time < pop.startTime || time > pop.endTime) continue;

      // Check if this population contains all required species
      let containsAll = true;
      for (const s of speciesSet) {
        if (!pop.species.has(s)) {
          containsAll = false;
          break;
        }
      }

      if (containsAll && pop.species.size < bestSize) {
        bestPop = pop;
        bestSize = pop.species.size;
      }
    }

    return bestPop;
  }

  /**
   * Get all descendent species from a gene tree node.
   */
  private getDescendentSpecies(node: GeneTreeNode): Set<string> {
    if (isGeneLeaf(node)) {
      const species = node.species || this.getSpeciesFromName(node.name);
      return new Set([species]);
    }

    const species = new Set<string>();
    for (const child of node.children) {
      for (const s of this.getDescendentSpecies(child)) {
        species.add(s);
      }
    }
    return species;
  }

  /**
   * Draw gene tree lineages within the species tubes.
   */
  private drawGeneLineages(
    geneRoot: GeneTreeNode,
    speciesPositions: Map<string, SpeciesPosition>,
    tipY: number,
    yScale: number
  ): void {
    const ctx = this.ctx;
    const geneLeaves = getGeneLeaves(geneRoot);

    // Assign x positions to gene tree tips within their species tubes
    const leafXPositions: Map<string, number> = new Map();

    // Group tips by species
    const tipsBySpecies: Map<string, GeneTreeNode[]> = new Map();
    for (const leaf of geneLeaves) {
      const species = leaf.species || this.getSpeciesFromName(leaf.name);
      if (!tipsBySpecies.has(species)) {
        tipsBySpecies.set(species, []);
      }
      tipsBySpecies.get(species)!.push(leaf);
    }

    // Position tips within each species tube
    for (const [species, tips] of tipsBySpecies) {
      const pos = speciesPositions.get(species);
      if (!pos) continue;

      const tubeWidth = pos.width * 0.8;  // Use 80% of tube for gene lineages (was 60%)
      const nTips = tips.length;

      tips.forEach((tip, i) => {
        let x: number;
        if (nTips === 1) {
          x = pos.x;
        } else {
          x = pos.x - tubeWidth / 2 + (tubeWidth * i) / (nTips - 1);
        }
        leafXPositions.set(tip.name, x);
      });
    }

    // Draw gene tree recursively
    ctx.strokeStyle = '#8B4513';  // Saddle brown for gene lineages
    ctx.lineWidth = 2;

    this.drawGeneNodeConstrained(geneRoot, tipY, leafXPositions, yScale);
  }

  /**
   * Recursively draw gene tree nodes with population constraints.
   */
  private drawGeneNodeConstrained(
    node: GeneTreeNode,
    tipY: number,
    leafXPositions: Map<string, number>,
    yScale: number
  ): { x: number; y: number; species: Set<string> } {
    const ctx = this.ctx;

    if (isGeneLeaf(node)) {
      const x = leafXPositions.get(node.name) || 100;
      // Leaf is at time 0, branch extends to parent at time = branchLength
      const parentTime = node.branchLength;
      const parentY = tipY + parentTime * yScale;

      // Draw vertical line from tip to where it connects to parent
      ctx.strokeStyle = '#8B4513';
      ctx.beginPath();
      ctx.moveTo(x, tipY);
      ctx.lineTo(x, parentY);
      ctx.stroke();

      // Draw individual label
      const label = node.individual || node.name.split('^')[1] || node.name;
      ctx.fillStyle = '#8B4513';
      ctx.font = '10px "Source Code Pro", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, x, tipY - 4);

      const species = node.species || this.getSpeciesFromName(node.name);
      return { x, y: parentY, species: new Set([species]) };
    }

    // Internal node - draw children first
    const childResults: { x: number; y: number; species: Set<string> }[] = [];
    for (const child of node.children) {
      const result = this.drawGeneNodeConstrained(child, tipY, leafXPositions, yScale);
      childResults.push(result);
    }

    // Coalescence time = age of this node (time from tips)
    const coalescentTime = this.getGeneNodeAge(node);
    const coalescentY = tipY + coalescentTime * yScale;
    // Time at top of this node's branch (where it connects to parent)
    const nodeEndTime = coalescentTime + node.branchLength;
    const nodeEndY = tipY + nodeEndTime * yScale;

    // Merge species from children
    const allSpecies = new Set<string>();
    for (const result of childResults) {
      for (const s of result.species) {
        allSpecies.add(s);
      }
    }

    // X position is average of children
    const nodeX = childResults.reduce((sum, r) => sum + r.x, 0) / childResults.length;

    // Validate that coalescence is in a valid population (should always pass if bpp output is correct)
    const pop = this.findPopulationForSpecies(allSpecies, coalescentTime);
    if (!pop) {
      console.warn(`Invalid coalescence: species ${Array.from(allSpecies).join(',')} at time ${coalescentTime.toFixed(6)} - no valid population found`);
    }

    // Draw lines from each child to the coalescent point
    ctx.strokeStyle = '#8B4513';
    for (const childResult of childResults) {
      // Vertical line from child to coalescent level
      ctx.beginPath();
      ctx.moveTo(childResult.x, childResult.y);
      ctx.lineTo(childResult.x, coalescentY);
      ctx.stroke();

      // Horizontal line to coalescent point
      ctx.beginPath();
      ctx.moveTo(childResult.x, coalescentY);
      ctx.lineTo(nodeX, coalescentY);
      ctx.stroke();
    }

    // Draw vertical branch from coalescent to where parent connects
    ctx.beginPath();
    ctx.moveTo(nodeX, coalescentY);
    ctx.lineTo(nodeX, nodeEndY);
    ctx.stroke();

    // Draw coalescent event marker
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(nodeX, coalescentY, 3, 0, Math.PI * 2);
    ctx.fill();

    return { x: nodeX, y: nodeEndY, species: allSpecies };
  }

  /**
   * Get age of gene node (time from tips, where tips = 0).
   * For leaves: age = 0
   * For internal nodes: age = child age + child branch length (should be same for all children)
   */
  private getGeneNodeAge(node: GeneTreeNode): number {
    if (isGeneLeaf(node)) {
      return 0;  // Leaves are at time 0 (present)
    }
    // All children coalesce at this node
    // Age = child's age + child's branch length to this node
    const firstChild = node.children[0];
    return this.getGeneNodeAge(firstChild) + firstChild.branchLength;
  }

  /**
   * Get gene tree total depth.
   */
  private getGeneTreeDepth(node: GeneTreeNode): number {
    if (isGeneLeaf(node)) {
      return node.branchLength;
    }
    const maxChildDepth = Math.max(...node.children.map(c => this.getGeneTreeDepth(c)));
    return node.branchLength + maxChildDepth;
  }

  /**
   * Extract species from a name like "A^a1".
   */
  private getSpeciesFromName(name: string): string {
    const caretIdx = name.indexOf('^');
    if (caretIdx !== -1) {
      return name.substring(0, caretIdx);
    }
    return this.imap.get(name) || name;
  }
}
