/**
 * Gene tree types for embedded gene tree visualization.
 * Gene trees contain individual tips that map to species.
 */

/**
 * A node in a gene tree.
 * Tips have names like "A^a1" where A is the species and a1 is the individual.
 */
export interface GeneTreeNode {
  name: string;           // Empty for internal nodes, "Species^individual" for tips
  branchLength: number;   // Branch length to parent
  children: GeneTreeNode[];
  // Computed properties for visualization
  species?: string;       // Species this tip belongs to (from imap)
  individual?: string;    // Individual name within species
}

/**
 * Mapping from individual names to species.
 */
export type Imap = Map<string, string>;

/**
 * A gene tree with its metadata.
 */
export interface GeneTree {
  root: GeneTreeNode;
  treeHeight: number;     // TH value from annotation
  treeLength: number;     // TL value from annotation
}

/**
 * Species tree node for embedded visualization.
 */
export interface SpeciesTreeNode {
  name: string;           // Species name (empty for internal nodes)
  branchLength: number;   // Branch length (tau)
  theta: number;          // Population size parameter
  children: SpeciesTreeNode[];
}

/**
 * Check if a gene tree node is a leaf.
 */
export function isGeneLeaf(node: GeneTreeNode): boolean {
  return node.children.length === 0;
}

/**
 * Get all leaf nodes from a gene tree.
 */
export function getGeneLeaves(node: GeneTreeNode): GeneTreeNode[] {
  if (isGeneLeaf(node)) {
    return [node];
  }
  return node.children.flatMap(child => getGeneLeaves(child));
}

/**
 * Get the total depth (sum of branch lengths) to the deepest leaf.
 */
export function getGeneTreeDepth(node: GeneTreeNode): number {
  if (isGeneLeaf(node)) {
    return node.branchLength;
  }
  const maxChildDepth = Math.max(...node.children.map(c => getGeneTreeDepth(c)));
  return node.branchLength + maxChildDepth;
}
