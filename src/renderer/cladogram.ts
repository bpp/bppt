/**
 * Cladogram renderer: All branches have equal length, emphasizing topology.
 * Vertical orientation with root at bottom and tips at top.
 * Ported from treev.py CladogramRenderer class.
 */

import { TreeNode, isLeaf as isLeafNode, getLeaves, getNodeDepth } from '../core/tree-types';
import { TreeRenderer } from './tree-renderer';

export class CladogramRenderer extends TreeRenderer {
  getName(): string {
    return 'Cladogram';
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

    const maxDepth = getNodeDepth(tree) || 1;

    // Calculate dimensions (swapped for vertical orientation)
    const availableWidth = width - this.style.marginLeft - this.style.marginRight;
    const availableHeight = height - this.style.marginTop - this.style.marginBottom;

    // Ensure minimum spacing between tips (horizontal spacing now)
    const tipSpacing = Math.max(
      this.style.minTipSpacing,
      availableWidth / Math.max(nLeaves - 1, 1)
    );
    const actualWidth = nLeaves > 1 ? tipSpacing * (nLeaves - 1) : 0;

    // Center horizontally if tree is smaller than canvas
    let xOffset = this.style.marginLeft;
    if (actualWidth < availableWidth) {
      xOffset += (availableWidth - actualWidth) / 2;
    }

    const yStep = availableHeight / maxDepth;
    const rootY = height - this.style.marginBottom;

    // Assign x positions to leaves
    const leafX: Map<string, number> = new Map();
    leaves.forEach((leaf, i) => {
      leafX.set(leaf, xOffset + i * tipSpacing);
    });

    // Draw tree starting from root (no stem)
    const minY = this.style.marginTop;
    this.drawNode(tree, rootY, 0, leafX, yStep, minY, true);
  }

  private drawNode(
    node: TreeNode,
    y: number,
    _depth: number,
    leafX: Map<string, number>,
    yStep: number,
    minY: number,
    isRoot: boolean = false
  ): number {
    const ctx = this.ctx;
    const style = this.style;

    if (isLeafNode(node)) {
      const x = leafX.get(node.name) || 100;

      // Leaf label at top
      ctx.fillStyle = style.labelColor;
      ctx.font = style.labelFontBold;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(node.name, x, minY - 6);

      // Return x position (vertical line drawn by parent)
      return x;
    }

    // Get child x positions first (recursive)
    const childResults: { x: number; isLeaf: boolean }[] = [];
    for (const child of node.children) {
      const childX = this.drawNode(child, y - yStep, _depth + 1, leafX, yStep, minY, false);
      childResults.push({ x: childX, isLeaf: isLeafNode(child) });
    }

    const childXs = childResults.map(c => c.x);
    const nodeX = childXs.reduce((a, b) => a + b, 0) / childXs.length;

    // Draw L-shaped connectors for smooth corners
    ctx.strokeStyle = style.branchColor;
    ctx.lineWidth = style.branchWidth;

    for (let i = 0; i < childResults.length; i++) {
      const childX = childResults[i].x;
      const childIsLeaf = childResults[i].isLeaf;
      const childY = childIsLeaf ? minY : (y - yStep);

      // Draw L-shape: horizontal from nodeX to childX, then vertical up
      ctx.beginPath();
      ctx.moveTo(nodeX, y);
      ctx.lineTo(childX, y);
      ctx.lineTo(childX, childY);
      ctx.stroke();
    }

    return nodeX;
  }
}
