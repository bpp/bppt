/**
 * Represents a node in the phylogenetic tree.
 * Ported from treev.py TreeNode dataclass.
 */
export interface TreeNode {
  name: string;
  branchLength: number;
  theta: number | null;
  children: TreeNode[];
}

/**
 * Create a new TreeNode with default values.
 */
export function createTreeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    name: '',
    branchLength: 0,
    theta: null,
    children: [],
    ...overrides
  };
}

/**
 * Check if a node is a leaf (has no children).
 */
export function isLeaf(node: TreeNode): boolean {
  return node.children.length === 0;
}

/**
 * Calculate maximum depth from this node to any leaf.
 * Depth is measured as sum of branch lengths.
 */
export function getDepth(node: TreeNode): number {
  if (isLeaf(node)) {
    return node.branchLength;
  }
  const maxChildDepth = Math.max(...node.children.map(getDepth));
  return node.branchLength + maxChildDepth;
}

/**
 * Get all leaf names in order (left to right).
 */
export function getLeaves(node: TreeNode): string[] {
  if (isLeaf(node)) {
    return [node.name];
  }
  const leaves: string[] = [];
  for (const child of node.children) {
    leaves.push(...getLeaves(child));
  }
  return leaves;
}

/**
 * Count total number of leaves in the subtree.
 */
export function countLeaves(node: TreeNode): number {
  if (isLeaf(node)) {
    return 1;
  }
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

/**
 * Get maximum depth in number of nodes (for cladogram layout).
 */
export function getNodeDepth(node: TreeNode, currentDepth: number = 0): number {
  if (isLeaf(node)) {
    return currentDepth;
  }
  return Math.max(...node.children.map(child => getNodeDepth(child, currentDepth + 1)));
}
