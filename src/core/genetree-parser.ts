/**
 * Parser for gene trees and imap files.
 * Gene trees have format: ((A^a1:0.001,B^b1:0.002):0.003,...); [TH=0.01, TL=0.02]
 * Imap files have format: individual\tspecies
 */

import { GeneTreeNode, GeneTree, Imap, isGeneLeaf } from './genetree-types';
import { TreeNode, isLeaf as isSpeciesLeaf } from './tree-types';
import { FileIndexer } from './file-indexer';
import { parseNewick } from './newick-parser';

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

    if (!part1 && part2) {
      // BPP format with no species: "^individual" (e.g., "^gs250")
      individual = part2;
      if (imap) {
        species = imap.get(individual);
      }
    } else if (part2.length <= 2 && part2 === part2.toUpperCase() && /^[A-Z]+$/.test(part2)) {
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

// ======================================================================
// Gene tree / species tree compatibility checking
// ======================================================================

/**
 * A population interval on the species tree.
 * Represents a branch (population) with its time span and descendant species.
 */
interface PopulationInterval {
  name: string;
  startTime: number;  // Younger bound (closer to tips, tips = 0)
  endTime: number;    // Older bound (closer to root)
  species: Set<string>;
}

/**
 * Build population intervals from a species tree.
 * Each branch in the species tree defines a population that exists
 * from when its child lineages diverge until it merges with its sibling.
 * The root population is extended to Infinity for deep coalescences.
 */
export function buildPopulationsFromSpeciesTree(root: TreeNode): PopulationInterval[] {
  const populations: PopulationInterval[] = [];

  function walk(node: TreeNode, nodeAge: number): Set<string> {
    if (isSpeciesLeaf(node)) {
      // Leaf population: from time 0 up to nodeAge (parent divergence time)
      populations.push({
        name: node.name,
        startTime: 0,
        endTime: nodeAge,
        species: new Set([node.name])
      });
      return new Set([node.name]);
    }

    // Compute age at this node's divergence point
    const childAge = nodeAge - node.branchLength;

    const allSpecies = new Set<string>();
    for (const child of node.children) {
      const childSpecies = walk(child, childAge);
      for (const s of childSpecies) {
        allSpecies.add(s);
      }
    }

    // This ancestral population exists from childAge to nodeAge
    const popName = node.name || `anc_${Array.from(allSpecies).sort().join('_')}`;
    populations.push({
      name: popName,
      startTime: childAge,
      endTime: nodeAge,
      species: allSpecies
    });

    return allSpecies;
  }

  // Compute total tree depth (age at root)
  function getSpeciesTreeAge(node: TreeNode): number {
    if (isSpeciesLeaf(node)) return node.branchLength;
    const maxChildDepth = Math.max(...node.children.map(c => getSpeciesTreeAge(c)));
    return node.branchLength + maxChildDepth;
  }

  const rootAge = getSpeciesTreeAge(root);
  walk(root, rootAge);

  // Extend the root population to Infinity for deep coalescences
  // The root population is the last one added (the one containing all species)
  const rootPop = populations[populations.length - 1];
  if (rootPop) {
    rootPop.endTime = Infinity;
  }

  return populations;
}

/**
 * Get the age (time from tips) of a gene tree node.
 * Leaves are at time 0; internal nodes = child age + child branch length.
 */
export function getGeneNodeAge(node: GeneTreeNode): number {
  if (isGeneLeaf(node)) {
    return 0;
  }
  const firstChild = node.children[0];
  return getGeneNodeAge(firstChild) + firstChild.branchLength;
}

/**
 * Get all descendant species from a gene tree node using the imap.
 */
export function getDescendantSpecies(node: GeneTreeNode, imap: Imap): Set<string> {
  if (isGeneLeaf(node)) {
    const species = node.species || imap.get(node.individual || node.name) || node.name;
    return new Set([species]);
  }

  const species = new Set<string>();
  for (const child of node.children) {
    for (const s of getDescendantSpecies(child, imap)) {
      species.add(s);
    }
  }
  return species;
}

/**
 * Check whether a single gene tree is compatible with a set of populations.
 * Returns a list of error messages for incompatible coalescent events.
 */
export function checkGeneTreeCompatibility(
  geneRoot: GeneTreeNode,
  populations: PopulationInterval[],
  imap: Imap
): string[] {
  const errors: string[] = [];
  // BPP outputs branch lengths with 6 decimal places, so rounding can create
  // non-ultrametric discrepancies up to 1e-6 per branch. Use 2e-6 to safely
  // account for accumulated rounding across multiple branches.
  const EPS = 2e-6;

  function walkGene(node: GeneTreeNode): void {
    if (isGeneLeaf(node)) return;

    // Check each child recursively first
    for (const child of node.children) {
      walkGene(child);
    }

    // Get coalescent time and descendant species at this node
    const coalescentTime = getGeneNodeAge(node);
    const descSpecies = getDescendantSpecies(node, imap);

    // Find a population that contains all descendant species at this time
    let found = false;
    for (const pop of populations) {
      // Check time bounds with epsilon tolerance
      if (coalescentTime < pop.startTime - EPS || coalescentTime > pop.endTime + EPS) continue;

      // Check if population contains all descendant species
      let containsAll = true;
      for (const s of descSpecies) {
        if (!pop.species.has(s)) {
          containsAll = false;
          break;
        }
      }

      if (containsAll) {
        found = true;
        break;
      }
    }

    if (!found) {
      const speciesStr = Array.from(descSpecies).sort().join(', ');
      errors.push(`Coalescent at time ${coalescentTime.toFixed(6)} for species {${speciesStr}} has no valid population`);
    }
  }

  walkGene(geneRoot);
  return errors;
}

/**
 * Incompatibility error details for reporting.
 */
export interface IncompatibilityError {
  iteration: number;
  locus: string;
  details: string[];
}

/**
 * Validate compatibility of gene trees against species trees across all MCMC samples.
 * Iterates all samples, checking species tree i against gene tree i for each locus.
 * Yields to UI thread periodically to keep interface responsive.
 * Returns list of incompatibility errors found.
 */
export async function validateGeneTreeCompatibility(
  speciesIndexer: FileIndexer,
  geneTreeIndexers: Map<string, FileIndexer>,
  locusNames: string[],
  imap: Imap,
  onProgress?: (checked: number, total: number) => void
): Promise<IncompatibilityError[]> {
  const errors: IncompatibilityError[] = [];

  const speciesCount = speciesIndexer.getTreeCount();
  // Use the minimum count across species tree and all gene tree files
  let totalIterations = speciesCount;
  for (const locusName of locusNames) {
    const geneIndexer = geneTreeIndexers.get(locusName);
    if (geneIndexer) {
      totalIterations = Math.min(totalIterations, geneIndexer.getTreeCount());
    }
  }

  const totalChecks = totalIterations * locusNames.length;
  let checked = 0;

  for (let i = 0; i < totalIterations; i++) {
    // Parse species tree for this iteration
    const speciesStr = await speciesIndexer.getTree(i);
    const speciesTree = parseNewick(speciesStr);
    if (!speciesTree) continue;

    const populations = buildPopulationsFromSpeciesTree(speciesTree);

    for (const locusName of locusNames) {
      const geneIndexer = geneTreeIndexers.get(locusName);
      if (!geneIndexer || i >= geneIndexer.getTreeCount()) {
        checked++;
        continue;
      }

      const geneStr = await geneIndexer.getTree(i);
      const geneTree = parseGeneTree(geneStr, imap);
      if (!geneTree) {
        checked++;
        continue;
      }

      const treeErrors = checkGeneTreeCompatibility(geneTree.root, populations, imap);
      if (treeErrors.length > 0) {
        errors.push({
          iteration: i + 1,
          locus: locusName,
          details: treeErrors
        });
      }

      checked++;
    }

    // Yield to UI thread every 50 iterations
    if (i % 50 === 0) {
      if (onProgress) {
        onProgress(checked, totalChecks);
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  if (onProgress) {
    onProgress(totalChecks, totalChecks);
  }

  return errors;
}
