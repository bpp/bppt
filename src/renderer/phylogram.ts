/**
 * Phylogram renderer: Branch lengths are proportional to evolutionary distance.
 * Vertical orientation with root at bottom and tips at top.
 * Includes scale bar showing expected substitutions.
 */

import { TreeNode, isLeaf, getLeaves, getDepth } from '../core/tree-types';
import { TreeRenderer } from './tree-renderer';

export class PhylogramRenderer extends TreeRenderer {
  private fixedScale: number | null = null;

  getName(): string {
    return 'Phylogram';
  }

  /**
   * Set a fixed scale for all trees (based on max tree depth).
   */
  setFixedScale(maxDepth: number): void {
    this.fixedScale = maxDepth;
  }

  render(tree: TreeNode | null, width: number, height: number): void {
    this.clear(width, height);

    // Set line styles for smooth corners
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';

    if (!tree) {
      this.drawNoTree(width, height);
      return;
    }

    if (width < 50 || height < 50) {
      return;
    }

    const leaves = getLeaves(tree);
    const nLeaves = leaves.length;

    if (nLeaves === 0) {
      return;
    }

    // Use fixed scale if set, otherwise use tree's own depth
    const scaleDepth = this.fixedScale || getDepth(tree) || 1;

    // Calculate dimensions (swapped for vertical orientation)
    // Use most of width for tree, small margin for scale bar
    const scaleBarWidth = 50;
    const marginLeft = 30;
    const marginRight = 10;
    const availableWidth = width - marginLeft - marginRight - scaleBarWidth;

    const availableHeight = height - this.style.marginTop - this.style.marginBottom;

    // Use full available width for tree
    const tipSpacing = nLeaves > 1 ? availableWidth / (nLeaves - 1) : 0;
    const xOffset = marginLeft;

    // Y scale: tips fixed at top, root moves down with height
    const yScale = availableHeight / scaleDepth;
    const tipY = this.style.marginTop;
    // Root position = tipY + (tree depth * scale)
    const treeDepth = getDepth(tree) || scaleDepth;
    const rootY = tipY + treeDepth * yScale;

    // Assign x positions to leaves
    const leafX: Map<string, number> = new Map();
    leaves.forEach((leaf, i) => {
      leafX.set(leaf, xOffset + i * tipSpacing);
    });

    // Draw tree
    this.drawNode(tree, rootY, leafX, yScale);

    // Draw scale bar (positioned relative to root)
    this.drawScaleBar(width, rootY, yScale, scaleDepth);
  }

  /**
   * Draw a scale bar on the right side showing expected substitutions.
   */
  private drawScaleBar(
    canvasWidth: number,
    rootY: number,
    yScale: number,
    maxDepth: number
  ): void {
    const ctx = this.ctx;
    const style = this.style;

    // Position scale bar on the right, aligned with root
    const barX = canvasWidth - 30;
    const barBottom = rootY;

    // Calculate a nice round number for the scale
    const niceScale = this.getNiceScaleValue(maxDepth);
    const scaleHeight = niceScale * yScale;

    // Draw the scale bar (vertical line with ticks)
    ctx.strokeStyle = style.labelColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barBottom);
    ctx.lineTo(barX, barBottom - scaleHeight);
    ctx.stroke();

    // Draw end ticks
    ctx.beginPath();
    ctx.moveTo(barX - 5, barBottom);
    ctx.lineTo(barX + 5, barBottom);
    ctx.moveTo(barX - 5, barBottom - scaleHeight);
    ctx.lineTo(barX + 5, barBottom - scaleHeight);
    ctx.stroke();

    // Draw scale label below the bar
    ctx.fillStyle = style.labelColor;
    ctx.font = 'bold 11px "Nunito Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const scaleLabel = this.formatScaleValue(niceScale);
    ctx.fillText(scaleLabel, barX, barBottom + 8);
  }

  /**
   * Get a nice round number for the scale bar.
   */
  private getNiceScaleValue(maxDepth: number): number {
    // Find a nice round number that's roughly 1/3 to 1/2 of max depth
    const target = maxDepth * 0.4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
    const normalized = target / magnitude;

    let nice: number;
    if (normalized < 1.5) {
      nice = 1;
    } else if (normalized < 3.5) {
      nice = 2;
    } else if (normalized < 7.5) {
      nice = 5;
    } else {
      nice = 10;
    }

    return nice * magnitude;
  }

  /**
   * Format scale value for display.
   */
  private formatScaleValue(value: number): string {
    if (value >= 0.01) {
      return value.toFixed(3);
    } else if (value >= 0.001) {
      return value.toFixed(4);
    } else {
      return value.toExponential(1);
    }
  }

  private drawNode(node: TreeNode, y: number, leafX: Map<string, number>, yScale: number): number {
    const ctx = this.ctx;
    const style = this.style;

    if (isLeaf(node)) {
      const x = leafX.get(node.name) || 100;
      const newY = y - node.branchLength * yScale;

      // Vertical branch to tip
      ctx.beginPath();
      ctx.strokeStyle = style.branchColor;
      ctx.lineWidth = style.branchWidth;
      ctx.moveTo(x, y);
      ctx.lineTo(x, newY);
      ctx.stroke();

      // Theta value beside branch
      if (style.showTheta && node.theta !== null) {
        const midY = (y + newY) / 2;
        ctx.fillStyle = style.thetaColor;
        ctx.font = style.thetaFont;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.theta.toFixed(4), x + 6, midY);
      }

      // Leaf label at top
      ctx.fillStyle = style.labelColor;
      ctx.font = style.labelFontBold;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(node.name, x, newY - 6);

      return x;
    }

    // Internal node
    const newY = y - node.branchLength * yScale;

    // Draw children first
    const childXs: number[] = [];
    for (const child of node.children) {
      const childX = this.drawNode(child, newY, leafX, yScale);
      childXs.push(childX);
    }

    const nodeX = childXs.reduce((a, b) => a + b, 0) / childXs.length;

    // Draw the branch structure as connected paths for smooth corners
    ctx.strokeStyle = style.branchColor;
    ctx.lineWidth = style.branchWidth;

    // Draw L-shaped connectors from horizontal bar to each child
    for (const childX of childXs) {
      ctx.beginPath();
      ctx.moveTo(nodeX, y); // Start from parent connection point
      ctx.lineTo(nodeX, newY); // Down to this node's level
      ctx.lineTo(childX, newY); // Horizontal to child
      ctx.stroke();
    }

    // Theta value beside the vertical branch
    if (style.showTheta && node.theta !== null && node.branchLength > 0) {
      const midY = (y + newY) / 2;
      ctx.fillStyle = style.thetaColor;
      ctx.font = style.thetaFont;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.theta.toFixed(4), nodeX + 6, midY);
    }

    return nodeX;
  }
}
