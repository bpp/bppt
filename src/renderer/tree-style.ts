/**
 * Configuration for tree appearance.
 * Matches the bpps Nature/Bio theme.
 */

export interface TreeStyle {
  // Colors
  branchColor: string;
  labelColor: string;
  thetaColor: string;
  backgroundColor: string;

  // Dimensions
  branchWidth: number;
  labelFont: string;
  labelFontBold: string;
  thetaFont: string;

  // Spacing
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  minTipSpacing: number;

  // Options
  showTheta: boolean;
}

/**
 * Default tree style matching bpps theme.
 */
export function createDefaultStyle(): TreeStyle {
  return {
    // Colors from bpps theme
    branchColor: '#4a7c59',    // --accent
    labelColor: '#1e3a29',     // --text-primary
    thetaColor: '#1e3a29',     // black (same as text)
    backgroundColor: '#ffffff', // --bg-card

    // Dimensions
    branchWidth: 4,
    labelFont: '11px "Nunito Sans", sans-serif',
    labelFontBold: 'bold 11px "Nunito Sans", sans-serif',
    thetaFont: '12px "Source Code Pro", monospace',

    // Spacing
    marginLeft: 60,
    marginRight: 100,
    marginTop: 50,
    marginBottom: 50,
    minTipSpacing: 30,

    // Options
    showTheta: true
  };
}
