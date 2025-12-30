/**
 * Newick parser with theta value support.
 * Ported from treev.py parse_newick function.
 *
 * Format: (children)name#theta:branchLength
 * Example: (K #0.003327: 0.001873, ((L #0.007904: 0.001468, H #0.002273: 0.001468) #0.004023: 0.000404, C #0.012111: 0.001873) #0.001427: 0.000001) #0.001673; 4
 */

import { TreeNode, createTreeNode } from './tree-types';

/**
 * Remove leading line number prefix and trailing tree count.
 * BPP outputs trees like: 1→(tree); 4
 * Or with spaces:         1→(tree); 4
 */
export function cleanNewick(newickStr: string): string {
  // Remove leading line number and arrow (e.g., "     1→" or "1→")
  let cleaned = newickStr.replace(/^\s*\d+\s*→\s*/, '');

  // Also handle alternative formats without arrow (just leading number and whitespace before paren)
  cleaned = cleaned.replace(/^\s*\d+\s+(?=\()/, '');

  // Remove trailing count after semicolon
  cleaned = cleaned.replace(/;\s*\d+\s*$/, ';');

  return cleaned.trim();
}

/**
 * Parse a Newick format string into a tree structure.
 * Handles theta values (marked with #) and branch lengths (marked with :).
 */
export function parseNewick(newickStr: string): TreeNode | null {
  newickStr = cleanNewick(newickStr);

  if (!newickStr || newickStr === ';') {
    return null;
  }

  // Remove trailing semicolon and whitespace
  newickStr = newickStr.replace(/;$/, '').trim();

  let pos = 0;

  function skipWhitespace(): void {
    while (pos < newickStr.length && /\s/.test(newickStr[pos])) {
      pos++;
    }
  }

  function parseNode(): TreeNode {
    const node = createTreeNode();

    skipWhitespace();

    // Check for children (starts with opening parenthesis)
    if (pos < newickStr.length && newickStr[pos] === '(') {
      pos++; // Skip '('

      while (true) {
        skipWhitespace();
        const child = parseNode();
        node.children.push(child);
        skipWhitespace();

        if (pos >= newickStr.length) {
          break;
        }

        if (newickStr[pos] === ',') {
          pos++; // Skip comma, continue to next child
        } else if (newickStr[pos] === ')') {
          pos++; // End of children
          break;
        }
      }
    }

    skipWhitespace();

    // Parse name (if any) - stop at #, :, ,, ), or (
    const nameChars: string[] = [];
    while (pos < newickStr.length && !'#,:();'.includes(newickStr[pos])) {
      nameChars.push(newickStr[pos]);
      pos++;
    }
    node.name = nameChars.join('').trim();

    skipWhitespace();

    // Parse theta value (preceded by #)
    if (pos < newickStr.length && newickStr[pos] === '#') {
      pos++; // Skip '#'
      const thetaChars: string[] = [];
      while (pos < newickStr.length && !',:();'.includes(newickStr[pos])) {
        thetaChars.push(newickStr[pos]);
        pos++;
      }
      const thetaStr = thetaChars.join('').trim();
      const theta = parseFloat(thetaStr);
      if (!isNaN(theta)) {
        node.theta = theta;
      }
    }

    skipWhitespace();

    // Parse branch length (preceded by :)
    if (pos < newickStr.length && newickStr[pos] === ':') {
      pos++; // Skip ':'
      const lengthChars: string[] = [];
      while (pos < newickStr.length && !',:();'.includes(newickStr[pos])) {
        lengthChars.push(newickStr[pos]);
        pos++;
      }
      const lengthStr = lengthChars.join('').trim();
      const length = parseFloat(lengthStr);
      if (!isNaN(length)) {
        node.branchLength = length;
      }
    }

    return node;
  }

  try {
    return parseNode();
  } catch (e) {
    console.error('Parse error:', e);
    return null;
  }
}

/**
 * Export a tree back to Newick format (for debugging).
 */
export function toNewick(node: TreeNode): string {
  let result = '';

  if (node.children.length > 0) {
    result += '(';
    result += node.children.map(toNewick).join(',');
    result += ')';
  }

  result += node.name;

  if (node.theta !== null) {
    result += ` #${node.theta.toFixed(6)}`;
  }

  if (node.branchLength > 0) {
    result += `:${node.branchLength.toFixed(6)}`;
  }

  return result;
}
