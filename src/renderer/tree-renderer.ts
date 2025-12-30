/**
 * Abstract base class for tree renderers.
 * Ported from treev.py TreeRenderer class.
 */

import { TreeNode } from '../core/tree-types';
import { TreeStyle, createDefaultStyle } from './tree-style';

export abstract class TreeRenderer {
  protected ctx: CanvasRenderingContext2D;
  protected style: TreeStyle;

  constructor(ctx: CanvasRenderingContext2D, style?: TreeStyle) {
    this.ctx = ctx;
    this.style = style || createDefaultStyle();
  }

  /**
   * Update the style configuration.
   */
  setStyle(style: Partial<TreeStyle>): void {
    this.style = { ...this.style, ...style };
  }

  /**
   * Get the current style.
   */
  getStyle(): TreeStyle {
    return this.style;
  }

  /**
   * Render the tree to the canvas.
   */
  abstract render(tree: TreeNode | null, width: number, height: number): void;

  /**
   * Get display name of this renderer.
   */
  abstract getName(): string;

  /**
   * Draw a message when no tree is loaded.
   */
  protected drawNoTree(width: number, height: number): void {
    this.ctx.fillStyle = this.style.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.fillStyle = '#999999';
    this.ctx.font = '12px "Nunito Sans", sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('No tree loaded', width / 2, height / 2);
  }

  /**
   * Clear the canvas with background color.
   */
  protected clear(width: number, height: number): void {
    this.ctx.fillStyle = this.style.backgroundColor;
    this.ctx.fillRect(0, 0, width, height);
  }
}
