/**
 * Parser for gene trees and imap files.
 * Gene trees have format: ((A^a1:0.001,B^b1:0.002):0.003,...); [TH=0.01, TL=0.02]
 * Imap files have format: individual\tspecies
 */

import { GeneTreeNode, GeneTree, Imap } from './genetree-types';

/**
 * Parse an imap file content into a Map.
 * Format: individual<tab>species (one per line)
 */
export function parseImap(content: string): Imap {
  const imap: Imap = new Map();
  const lines = content.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split by tab or whitespace
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const individual = parts[0];
      const species = parts[1];
      imap.set(individual, species);
    }
  }

  return imap;
}

/**
 * Parse a gene tree string (Newick format with annotations).
 * Returns the tree and extracted TH/TL values.
 */
export function parseGeneTree(newickStr: string, imap?: Imap): GeneTree | null {
  // Remove leading line number and arrow (e.g., "     1→" or "1→")
  let treeStr = newickStr.replace(/^\s*\d+\s*→\s*/, '');

  // Extract TH and TL values from annotation
  let treeHeight = 0;
  let treeLength = 0;

  const annotationMatch = treeStr.match(/\[TH=([0-9.]+),\s*TL=([0-9.]+)\]/);
  if (annotationMatch) {
    treeHeight = parseFloat(annotationMatch[1]);
    treeLength = parseFloat(annotationMatch[2]);
  }

  // Remove annotation and trailing content
  treeStr = treeStr.replace(/\s*\[TH=[^\]]+\].*$/, '').trim();

  // Remove trailing semicolon and any tree count
  treeStr = treeStr.replace(/;\s*\d*\s*$/, '').trim();

  if (!treeStr) {
    return null;
  }

  try {
    const root = parseNewickNode(treeStr, imap);
    if (!root) return null;

    return {
      root,
      treeHeight,
      treeLength
    };
  } catch (e) {
    console.error('Failed to parse gene tree:', e);
    return null;
  }
}

/**
 * Parse a Newick node recursively.
 */
function parseNewickNode(str: string, imap?: Imap): GeneTreeNode | null {
  str = str.trim();
  if (!str) return null;

  // Check if this is an internal node (starts with parenthesis)
  if (str.startsWith('(')) {
    // Find the matching closing parenthesis
    let depth = 0;
    let closeIdx = -1;

    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) {
          closeIdx = i;
          break;
        }
      }
    }

    if (closeIdx === -1) {
      console.error('Unmatched parenthesis in:', str);
      return null;
    }

    // Parse children (content between parentheses)
    const childrenStr = str.substring(1, closeIdx);
    const children = parseChildren(childrenStr, imap);

    // Parse the rest (branch length after closing paren)
    const rest = str.substring(closeIdx + 1);
    const branchLength = parseBranchLength(rest);

    return {
      name: '',
      branchLength,
      children
    };
  } else {
    // Leaf node: name:branchLength or just name
    return parseLeafNode(str, imap);
  }
}

/**
 * Parse children separated by commas at the top level.
 */
function parseChildren(str: string, imap?: Imap): GeneTreeNode[] {
  const children: GeneTreeNode[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i <= str.length; i++) {
    const char = str[i];

    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if ((char === ',' || i === str.length) && depth === 0) {
      const childStr = str.substring(start, i).trim();
      if (childStr) {
        const child = parseNewickNode(childStr, imap);
        if (child) {
          children.push(child);
        }
      }
      start = i + 1;
    }
  }

  return children;
}

/**
 * Parse a leaf node (name with optional branch length).
 * Format: Species^individual:branchLength or just Species^individual
 */
function parseLeafNode(str: string, imap?: Imap): GeneTreeNode {
  // Split on colon for branch length
  const colonIdx = str.indexOf(':');

  let name: string;
  let branchLength: number;

  if (colonIdx !== -1) {
    name = str.substring(0, colonIdx).trim();
    branchLength = parseFloat(str.substring(colonIdx + 1)) || 0;
  } else {
    name = str.trim();
    branchLength = 0;
  }

  // Parse species and individual from name
  let species: string | undefined;
  let individual: string | undefined;

  // Check if name contains ^ (handles both formats)
  const caretIdx = name.indexOf('^');
  if (caretIdx !== -1) {
    const part1 = name.substring(0, caretIdx);
    const part2 = name.substring(caretIdx + 1);

    // Detect format: bpp outputs "a1^A" (individual^Species)
    // Our format is "A^a1" (Species^individual)
    // Species names are typically all uppercase single letters
    if (part2.length <= 2 && part2 === part2.toUpperCase() && /^[A-Z]+$/.test(part2)) {
      // bpp format: individual^Species (e.g., "a1^A")
      species = part2;
      individual = part1;
    } else {
      // Standard format: Species^individual (e.g., "A^a1")
      species = part1;
      individual = part2;
    }
  } else if (imap) {
    // Look up in imap if no ^ in name
    species = imap.get(name);
    individual = name;
  }

  return {
    name,
    branchLength,
    children: [],
    species,
    individual
  };
}

/**
 * Extract branch length from a string like ":0.001234" or just get 0.
 */
function parseBranchLength(str: string): number {
  const match = str.match(/:([0-9.eE+-]+)/);
  if (match) {
    return parseFloat(match[1]) || 0;
  }
  return 0;
}

/**
 * Parse multiple gene trees from a file content.
 */
export function parseGeneTreeFile(content: string, imap?: Imap): GeneTree[] {
  const trees: GeneTree[] = [];
  const lines = content.trim().split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tree = parseGeneTree(trimmed, imap);
    if (tree) {
      trees.push(tree);
    }
  }

  return trees;
}
