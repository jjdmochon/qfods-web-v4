// ==========================================================================
// QFDOS v4 Modernist Cheminformatics Engine (RDKit WASM MinimalLib)
// High-performance 2D structure & reaction renderer, molecular descriptors,
// Lipinski & Veber druglikeness profiler, and Morgan Fingerprint similarity.
// ==========================================================================

const RDKIT_CDN_URL = 'https://unpkg.com/@rdkit/rdkit@2025.3.4-1.0.0/dist/RDKit_minimal.js';
const MODERNIST_RED = '#ec3013';
const MODERNIST_RED_RGBA = [0.9255, 0.1882, 0.0745, 0.8]; // #ec3013 in normalized [r, g, b, a]
const MODERNIST_INK = '#111111';
const MODERNIST_PAPER = '#ffffff';

let rdkitInstance = null;
let rdkitLoadingPromise = null;

/**
 * Initializes and caches a singleton instance of RDKit MinimalLib (WASM).
 * Inspects window.RDKit, window.initRDKitModule, or dynamically injects
 * the script tag from CDN if running in a browser without RDKit preloaded.
 * Also supports Node.js test environments.
 * 
 * @param {Object} [config] Optional configuration passed to initRDKitModule
 * @returns {Promise<Object|null>} Resolved RDKit instance or null on failure
 */
export async function initRDKit(config = {}) {
  if (rdkitInstance) return rdkitInstance;
  if (rdkitLoadingPromise) return rdkitLoadingPromise;

  rdkitLoadingPromise = new Promise(async (resolve) => {
    // 1. Direct instance already available on window / globalThis
    const g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (g && g.RDKit && typeof g.RDKit.get_mol === 'function') {
      rdkitInstance = g.RDKit;
      return resolve(rdkitInstance);
    }

    // Helper to invoke initRDKitModule once found
    const bootModule = (initFn) => {
      initFn({
        print: () => {},
        printErr: () => {},
        ...config
      }).then((instance) => {
        if (g) g.RDKit = instance;
        rdkitInstance = instance;
        resolve(instance);
      }).catch((err) => {
        console.warn('[RDKit WASM] Boot error, operating in fallback mode:', err);
        resolve(null);
      });
    };

    // 2. initRDKitModule already globally registered
    if (g && typeof g.initRDKitModule === 'function') {
      return bootModule(g.initRDKitModule);
    }

    // 3. Node.js environment support
    if (typeof window === 'undefined' && typeof require === 'function') {
      try {
        const initFn = require(RDKIT_CDN_URL.replace('https://unpkg.com/', ''));
        if (typeof initFn === 'function') return bootModule(initFn);
      } catch (e) {
        // Continue to check global or fallback
      }
    }

    // 4. Browser environment: ensure CDN script tag is loaded
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      let existingScript = document.querySelector(`script[src*="RDKit_minimal.js"]`);
      
      if (!existingScript) {
        existingScript = document.createElement('script');
        existingScript.src = RDKIT_CDN_URL;
        existingScript.async = true;
        document.head.appendChild(existingScript);
      }

      // Wait for script to load and set window.initRDKitModule
      let pollCount = 0;
      const maxPolls = 60; // 60 * 100ms = 6.0s timeout
      const timer = setInterval(() => {
        pollCount++;
        if (window.initRDKitModule && typeof window.initRDKitModule === 'function') {
          clearInterval(timer);
          bootModule(window.initRDKitModule);
        } else if (pollCount >= maxPolls) {
          clearInterval(timer);
          console.warn('[RDKit WASM] Timeout waiting for CDN script, fallback active.');
          resolve(null);
        }
      }, 100);
      return;
    }

    // If neither environment could provide RDKit
    resolve(null);
  });

  return rdkitLoadingPromise;
}

/**
 * Returns the active RDKit instance, initializing it if necessary.
 */
export async function getRDKit() {
  return await initRDKit();
}

/**
 * Render a 2D chemical structure into clean architectural SVG.
 * Supports substructure/pharmacophore highlighting in Modernist red (#ec3013),
 * light/dark themes, stereochemistry annotation, and customizable bond line width.
 * 
 * @param {string} smiles SMILES representation of the molecule
 * @param {Object} [options] Rendering options
 * @param {number} [options.width=240] SVG width in pixels
 * @param {number} [options.height=160] SVG height in pixels
 * @param {string|Array<string>} [options.highlightSmarts] SMARTS pattern to highlight
 * @param {Array<number>} [options.highlightAtoms] Explicit atom indices to highlight
 * @param {Array<number>} [options.highlightBonds] Explicit bond indices to highlight
 * @param {Array<number>} [options.highlightColour] [r,g,b,a] color (defaults to Modernist Red)
 * @param {string} [options.theme='light'] 'light' or 'dark'
 * @param {number} [options.bondLineWidth=2.0] Architectural bond line width
 * @param {boolean} [options.addStereoAnnotation=true] Render R/S stereocenters
 * @param {boolean} [options.clearBackground=true] Transparent background
 * @param {string} [options.legend=''] Text legend below molecule
 * @returns {Promise<string>} SVG markup string
 */
export async function renderMoleculeSvg(smiles, options = {}, maybeHeight) {
  if (!smiles || typeof smiles !== 'string') return '';

  let config = typeof options === 'number'
    ? { width: options, height: typeof maybeHeight === 'number' ? maybeHeight : 160 }
    : (options || {});

  const {
    width = 240,
    height = 160,
    highlightSmarts = null,
    highlightAtoms = [],
    highlightBonds = [],
    highlightColour = MODERNIST_RED_RGBA,
    theme = 'light',
    bondLineWidth = 2.0,
    addStereoAnnotation = true,
    clearBackground = true,
    legend = ''
  } = config;

  try {
    const rdkit = await initRDKit();
    if (rdkit) {
      const mol = rdkit.get_mol(smiles.trim());
      if (mol && mol.is_valid()) {
        const atomsToHighlight = new Set(highlightAtoms);
        const bondsToHighlight = new Set(highlightBonds);

        // Perform substructure matching if SMARTS is specified
        if (highlightSmarts) {
          const smartsList = Array.isArray(highlightSmarts) ? highlightSmarts : [highlightSmarts];
          for (const sm of smartsList) {
            if (!sm) continue;
            const qmol = rdkit.get_qmol(sm.trim());
            if (qmol && qmol.is_valid()) {
              try {
                const matchStr = mol.get_substruct_matches(qmol);
                const matches = JSON.parse(matchStr || '[]');
                matches.forEach(m => {
                  if (m.atoms) m.atoms.forEach(a => atomsToHighlight.add(a));
                  if (m.bonds) m.bonds.forEach(b => bondsToHighlight.add(b));
                });
              } catch (err) {
                console.warn('[RDKit] Substructure match error:', err);
              }
              qmol.delete();
            }
          }
        }

        const details = {
          width: Math.round(width),
          height: Math.round(height),
          bondLineWidth: Number(bondLineWidth) || 2.0,
          addStereoAnnotation: Boolean(addStereoAnnotation),
          clearBackground: Boolean(clearBackground),
          legend: legend || ''
        };

        if (atomsToHighlight.size > 0 || bondsToHighlight.size > 0) {
          details.atoms = Array.from(atomsToHighlight);
          details.bonds = Array.from(bondsToHighlight);
          details.highlightColour = highlightColour;
        }

        let svg = mol.get_svg_with_highlights 
          ? mol.get_svg_with_highlights(JSON.stringify(details))
          : mol.get_svg(details.width, details.height);

        mol.delete();

        // Apply dark theme adjustments if requested
        if (theme === 'dark' && svg) {
          svg = applyDarkThemeToSvg(svg);
        }

        return svg;
      }
      if (mol) mol.delete();
    }
  } catch (e) {
    console.warn('[RDKit] Error rendering SMILES with WASM, using fallback:', e);
  }

  // Modernist Architectural Fallback SVG
  return generateFallbackSvg(smiles, width, height, theme);
}

/**
 * Render a chemical reaction scheme into clean architectural SVG.
 * Supports reaction SMILES in format: 'reactivo1.reactivo2 >> producto'
 * or 'reactivo1 + reactivo2 >> producto' with optional reagents/conditions.
 * 
 * @param {string} reactionSmiles Reaction SMILES (e.g. 'A.B>>C' or 'A + B >> C')
 * @param {Object} [options] Rendering options
 * @param {number} [options.width=600] SVG width
 * @param {number} [options.height=200] SVG height
 * @param {number} [options.bondLineWidth=2.0] Bond line width
 * @param {string} [options.theme='light'] Theme
 * @param {string} [options.reagents=''] Reagent/catalyst label over arrow
 * @returns {Promise<string>} SVG markup string
 */
export async function renderReactionSvg(reactionSmiles, options = {}, maybeHeight) {
  if (!reactionSmiles || typeof reactionSmiles !== 'string') return '';

  let config = typeof options === 'number'
    ? { width: options, height: typeof maybeHeight === 'number' ? maybeHeight : 200 }
    : (options || {});

  const {
    width = 600,
    height = 200,
    bondLineWidth = 2.0,
    theme = 'light',
    reagents = ''
  } = config;

  // Normalize reaction SMILES (convert '+' to '.' within sides, strip whitespace)
  const normalizedRxn = normalizeReactionSmiles(reactionSmiles);

  try {
    const rdkit = await initRDKit();
    if (rdkit && typeof rdkit.get_rxn === 'function') {
      const rxn = rdkit.get_rxn(normalizedRxn);
      if (rxn) {
        let svg = rxn.get_svg ? rxn.get_svg(Math.round(width), Math.round(height)) : null;
        rxn.delete();

        if (svg) {
          if (reagents) {
            svg = injectReagentsIntoReactionSvg(svg, reagents, width, height, theme);
          }
          if (theme === 'dark') {
            svg = applyDarkThemeToSvg(svg);
          }
          return svg;
        }
      }
    }
  } catch (e) {
    console.warn('[RDKit] Error rendering reaction scheme with WASM, using fallback:', e);
  }

  // Fallback reaction scheme with architectural Modernist styling
  return generateFallbackReactionSvg(reactionSmiles, width, height, reagents, theme);
}

/**
 * Normalizes user reaction notation into valid RDKit reaction SMILES.
 * Examples: 'A + B >> C' -> 'A.B>>C'
 */
function normalizeReactionSmiles(rxn) {
  if (!rxn) return '';
  const delimiter = rxn.includes('>>') ? '>>' : (rxn.includes('>') ? '>' : null);
  if (!delimiter) return rxn.trim();

  const parts = rxn.split(delimiter);
  const normalizedParts = parts.map(part => {
    return part
      .split('+')
      .map(comp => comp.trim().replace(/^\d+\s*/, '')) // strip stoichiometric numbers e.g. '2 '
      .filter(Boolean)
      .join('.');
  });

  return normalizedParts.join(delimiter);
}

/**
 * Computes essential physicochemical descriptors client-side via RDKit MinimalLib.
 * Returns Molecular Weight (MW), cLogP / ALOGP, Hydrogen Bond Donors (HBD),
 * Hydrogen Bond Acceptors (HBA), TPSA, Rotatable Bonds (RotB), Fraction Csp3,
 * and Number of Aromatic Rings.
 * 
 * @param {string} smiles Molecule SMILES
 * @returns {Promise<Object|null>} Object containing parsed descriptors or null
 */
export async function computeDescriptors(smiles) {
  if (!smiles || typeof smiles !== 'string') return null;

  try {
    const rdkit = await initRDKit();
    if (!rdkit) return null;

    const mol = rdkit.get_mol(smiles.trim());
    if (!mol || !mol.is_valid()) {
      if (mol) mol.delete();
      return null;
    }

    const rawStr = mol.get_descriptors();
    const raw = JSON.parse(rawStr || '{}');

    // Extract exact properties required by QFDOS specifications
    const mw = Number((raw.amw || raw.exactmw || 0).toFixed(2));
    const exactMw = Number((raw.exactmw || 0).toFixed(4));
    const logp = Number((raw.CrippenClogP !== undefined ? raw.CrippenClogP : 0).toFixed(2));
    const hbd = Number(raw.NumHBD !== undefined ? raw.NumHBD : (raw.lipinskiHBD || 0));
    const hba = Number(raw.NumHBA !== undefined ? raw.NumHBA : (raw.lipinskiHBA || 0));
    const tpsa = Number((raw.tpsa !== undefined ? raw.tpsa : 0).toFixed(2));
    const rotb = Number(raw.NumRotatableBonds !== undefined ? raw.NumRotatableBonds : 0);
    const fractionCsp3 = Number((raw.FractionCSP3 !== undefined ? raw.FractionCSP3 : 0).toFixed(3));
    const aromaticRings = Number(raw.NumAromaticRings !== undefined ? raw.NumAromaticRings : 0);
    const totalRings = Number(raw.NumRings !== undefined ? raw.NumRings : 0);
    const heavyAtoms = Number(raw.NumHeavyAtoms !== undefined ? raw.NumHeavyAtoms : 0);

    mol.delete();

    return {
      smiles: smiles.trim(),
      mw,
      exactMw,
      logp,
      hbd,
      hba,
      tpsa,
      rotb,
      fractionCsp3,
      aromaticRings,
      totalRings,
      heavyAtoms,
      raw
    };
  } catch (err) {
    console.error('[RDKit] Error computing descriptors:', err);
    return null;
  }
}

/**
 * Strict evaluation of Lipinski's Rule of 5 and Veber's Rules for drug-likeness.
 * 
 * Lipinski (Ro5):
 * 1. Molecular Weight (MW) <= 500 Da
 * 2. Lipophilicity (cLogP) <= 5.0
 * 3. Hydrogen Bond Donors (HBD) <= 5
 * 4. Hydrogen Bond Acceptors (HBA) <= 10
 * 
 * Veber Rules:
 * 1. Rotatable Bonds (RotB) <= 10
 * 2. Polar Surface Area (TPSA) <= 140 Å²
 * 
 * @param {Object|string} descriptorsOrSmiles Precomputed descriptors object or SMILES string
 * @returns {Promise<Object>} Comprehensive evaluation report
 */
export async function evaluateLipinskiVeber(descriptorsOrSmiles) {
  let d = descriptorsOrSmiles;
  if (typeof d === 'string') {
    d = await computeDescriptors(d);
  }

  if (!d) {
    return {
      valid: false,
      error: 'Invalid input or SMILES could not be parsed'
    };
  }

  // Lipinski Rule Checks
  const lipinskiChecks = [
    {
      id: 'mw',
      name: 'Peso Molecular (MW)',
      criterion: '<= 500 Da',
      value: d.mw,
      unit: 'g/mol',
      passed: d.mw <= 500
    },
    {
      id: 'logp',
      name: 'Lipofilia (cLogP)',
      criterion: '<= 5.0',
      value: d.logp,
      unit: '',
      passed: d.logp <= 5.0
    },
    {
      id: 'hbd',
      name: 'Donadores de H (HBD)',
      criterion: '<= 5',
      value: d.hbd,
      unit: '',
      passed: d.hbd <= 5
    },
    {
      id: 'hba',
      name: 'Aceptores de H (HBA)',
      criterion: '<= 10',
      value: d.hba,
      unit: '',
      passed: d.hba <= 10
    }
  ];

  // Veber Rule Checks
  const veberChecks = [
    {
      id: 'rotb',
      name: 'Enlaces Rotables (RotB)',
      criterion: '<= 10',
      value: d.rotb,
      unit: '',
      passed: d.rotb <= 10
    },
    {
      id: 'tpsa',
      name: 'Superficie Polar (TPSA)',
      criterion: '<= 140 Å²',
      value: d.tpsa,
      unit: 'Å²',
      passed: d.tpsa <= 140.0
    }
  ];

  const lipinskiViolations = lipinskiChecks.filter(c => !c.passed).length;
  const veberViolations = veberChecks.filter(c => !c.passed).length;

  // Lipinski Rule: standard compliance allows at most 1 violation; strict is 0
  const lipinskiStandardPass = lipinskiViolations <= 1;
  const lipinskiStrictPass = lipinskiViolations === 0;
  const veberPass = veberViolations === 0;
  const drugLike = lipinskiStandardPass && veberPass;

  // Lead-likeness rule (bonus criterion: MW <= 350, cLogP <= 3, RotB <= 7)
  const leadLike = d.mw <= 350 && d.logp <= 3.0 && d.rotb <= 7;

  return {
    valid: true,
    smiles: d.smiles,
    descriptors: d,
    lipinski: {
      passed: lipinskiStandardPass,
      strictPassed: lipinskiStrictPass,
      violations: lipinskiViolations,
      checks: lipinskiChecks
    },
    veber: {
      passed: veberPass,
      violations: veberViolations,
      checks: veberChecks
    },
    drugLike,
    leadLike,
    summary: `${drugLike ? 'CUMPLE' : 'NO CUMPLE'} perfil de biodisponibilidad oral (Lipinski: ${lipinskiViolations} violaciones, Veber: ${veberViolations} violaciones)`
  };
}

/**
 * Computes Tanimoto similarity coefficient between two molecules based on
 * Morgan Fingerprints (ECFP-equivalent, radius 2, 2048 bits).
 * 
 * Formula: T(A, B) = |A ∩ B| / |A ∪ B| = Nab / (Na + Nb - Nab)
 * 
 * @param {string} smilesA SMILES of molecule A
 * @param {string} smilesB SMILES of molecule B
 * @param {Object} [options] Options (radius=2, nBits=2048)
 * @returns {Promise<Object>} Tanimoto coefficient (0.0 to 1.0) and metrics
 */
export async function calculateTanimoto(smilesA, smilesB, options = {}) {
  if (!smilesA || !smilesB) {
    return { similarity: 0, similarityPercent: '0.0%', valid: false, error: 'Missing SMILES' };
  }

  const { radius = 2, nBits = 2048 } = options;

  try {
    const rdkit = await initRDKit();
    if (!rdkit) {
      return { similarity: 0, similarityPercent: '0.0%', valid: false, error: 'RDKit WASM unavailable' };
    }

    const molA = rdkit.get_mol(smilesA.trim());
    const molB = rdkit.get_mol(smilesB.trim());

    if (!molA || !molA.is_valid() || !molB || !molB.is_valid()) {
      if (molA) molA.delete();
      if (molB) molB.delete();
      return { similarity: 0, similarityPercent: '0.0%', valid: false, error: 'Invalid molecule structure' };
    }

    const fpConfig = JSON.stringify({ radius, nBits });
    const fpStrA = molA.get_morgan_fp(fpConfig);
    const fpStrB = molB.get_morgan_fp(fpConfig);

    molA.delete();
    molB.delete();

    let both = 0;
    let onlyA = 0;
    let onlyB = 0;

    const len = Math.min(fpStrA.length, fpStrB.length);
    for (let i = 0; i < len; i++) {
      const bitA = fpStrA.charCodeAt(i) === 49; // '1'
      const bitB = fpStrB.charCodeAt(i) === 49; // '1'
      if (bitA && bitB) {
        both++;
      } else if (bitA) {
        onlyA++;
      } else if (bitB) {
        onlyB++;
      }
    }

    const union = both + onlyA + onlyB;
    const similarity = union === 0 ? 1.0 : Number((both / union).toFixed(4));
    const similarityPercent = (similarity * 100).toFixed(1) + '%';

    return {
      valid: true,
      similarity,
      similarityPercent,
      bitsA: both + onlyA,
      bitsB: both + onlyB,
      commonBits: both,
      radius,
      nBits
    };
  } catch (err) {
    console.error('[RDKit] Error calculating Tanimoto:', err);
    return { similarity: 0, similarityPercent: '0.0%', valid: false, error: err.message };
  }
}

/**
 * Searches for substructure matches of a SMARTS pattern in a target SMILES molecule.
 * Returns atom and bond indices corresponding to the pharmacophore or subfragment.
 * 
 * @param {string} smiles Target molecule SMILES
 * @param {string} smarts Query pattern SMARTS
 * @returns {Promise<Object>} Match results including atoms, bonds, and match count
 */
export async function findSubstructureMatches(smiles, smarts) {
  if (!smiles || !smarts) {
    return { hasMatch: false, matchCount: 0, matches: [], matchedAtoms: [], matchedBonds: [] };
  }

  try {
    const rdkit = await initRDKit();
    if (!rdkit) {
      return { hasMatch: false, matchCount: 0, matches: [], matchedAtoms: [], matchedBonds: [], error: 'RDKit unavailable' };
    }

    const mol = rdkit.get_mol(smiles.trim());
    const qmol = rdkit.get_qmol(smarts.trim());

    if (!mol || !mol.is_valid() || !qmol || !qmol.is_valid()) {
      if (mol) mol.delete();
      if (qmol) qmol.delete();
      return { hasMatch: false, matchCount: 0, matches: [], matchedAtoms: [], matchedBonds: [], error: 'Invalid SMILES or SMARTS' };
    }

    const matchJsonStr = mol.get_substruct_matches(qmol);
    const matches = JSON.parse(matchJsonStr || '[]');

    const atomSet = new Set();
    const bondSet = new Set();

    matches.forEach(m => {
      if (m.atoms) m.atoms.forEach(a => atomSet.add(a));
      if (m.bonds) m.bonds.forEach(b => bondSet.add(b));
    });

    mol.delete();
    qmol.delete();

    return {
      hasMatch: matches.length > 0,
      matchCount: matches.length,
      matches,
      matchedAtoms: Array.from(atomSet),
      matchedBonds: Array.from(bondSet)
    };
  } catch (err) {
    console.error('[RDKit] Error finding substructure matches:', err);
    return { hasMatch: false, matchCount: 0, matches: [], matchedAtoms: [], matchedBonds: [], error: err.message };
  }
}

// ==========================================================================
// SVG Utilities, Theme Transformers & Architectural Fallbacks
// ==========================================================================

/**
 * Transforms standard light-themed RDKit SVG into Modernist dark mode.
 * Preserves heteroatom colors (N, O, S, Cl, etc.) and Modernist red (#ec3013),
 * while inverting charcoal/black bonds to high-contrast crisp white/silver.
 */
function applyDarkThemeToSvg(svg) {
  if (!svg) return svg;

  // Replace background fill from white to dark ink
  let modified = svg.replace(/fill=['"]#FFFFFF['"]/gi, `fill="${MODERNIST_INK}"`);
  modified = modified.replace(/fill:\s*#FFFFFF/gi, `fill:${MODERNIST_INK}`);

  // Invert pure black strokes and texts to clean off-white (#f5f5f5)
  // but protect highlighted elements (red #ec3013)
  modified = modified.replace(/stroke=['"]#000000['"]/gi, `stroke="#f5f5f5"`);
  modified = modified.replace(/stroke:\s*#000000/gi, `stroke:#f5f5f5`);
  modified = modified.replace(/fill=['"]#000000['"]/gi, `fill="#f5f5f5"`);
  modified = modified.replace(/fill:\s*#000000/gi, `fill:#f5f5f5`);

  return modified;
}

/**
 * Injects reagent/catalyst text cleanly into the center above the reaction arrow.
 */
function injectReagentsIntoReactionSvg(svg, reagents, width, height, theme) {
  if (!svg || !reagents) return svg;
  const textColor = theme === 'dark' ? '#f5f5f5' : MODERNIST_INK;
  const textX = Math.round(width / 2);
  const textY = Math.round(height / 2) - 18;

  const reagentAnnotation = `
    <text x="${textX}" y="${textY}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="${textColor}">
      ${escapeXml(reagents)}
    </text>
  `;

  return svg.replace('</svg>', `${reagentAnnotation}</svg>`);
}

/**
 * Generates a clean, crisp architectural SVG fallback when WASM is not available.
 */
export function generateFallbackSvg(smiles, width = 240, height = 160, theme = 'light') {
  const safeSmiles = escapeXml(smiles || '');
  const isDark = theme === 'dark';
  const bg = isDark ? MODERNIST_INK : MODERNIST_PAPER;
  const stroke = isDark ? '#f5f5f5' : MODERNIST_INK;
  const border = isDark ? '#333333' : '#111111';
  const subText = isDark ? '#999999' : '#666666';

  const w = Number(width) || 240;
  const h = Number(height) || 160;
  const cx = w / 2;
  const cy = h / 2 - 6;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:${bg}; border:1px solid ${border};">
      <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}" />
      <!-- Architectural Grid Mark -->
      <line x1="8" y1="8" x2="16" y2="8" stroke="${MODERNIST_RED}" stroke-width="2" />
      <line x1="8" y1="8" x2="8" y2="16" stroke="${MODERNIST_RED}" stroke-width="2" />
      
      <!-- Stylized Benzene Ring Wireframe -->
      <g stroke="${stroke}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="${cx - 28},${cy - 14} ${cx},${cy - 30} ${cx + 28},${cy - 14} ${cx + 28},${cy + 18} ${cx},${cy + 34} ${cx - 28},${cy + 18}" />
        <circle cx="${cx}" cy="${cy + 2}" r="15" stroke="${stroke}" stroke-dasharray="3,3" />
        <line x1="${cx + 28}" y1="${cy - 14}" x2="${cx + 50}" y2="${cy - 26}" />
        <line x1="${cx - 28}" y1="${cy - 14}" x2="${cx - 50}" y2="${cy - 26}" />
        <line x1="${cx}" y1="${cy + 34}" x2="${cx}" y2="${cy + 52}" />
      </g>

      <!-- Structure SMILES Label -->
      <text x="${cx}" y="${h - 10}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="9" fill="${stroke}" font-weight="600">
        ${safeSmiles.length > 30 ? safeSmiles.slice(0, 27) + '...' : safeSmiles}
      </text>
      <text x="${w - 8}" y="14" text-anchor="end" font-family="'Archivo', sans-serif" font-size="8" fill="${subText}" font-weight="700">
        2D FALLBACK
      </text>
    </svg>
  `.trim();
}

/**
 * Generates an architectural fallback for reaction schemes.
 */
export function generateFallbackReactionSvg(reactionSmiles, width = 600, height = 200, reagents = '', theme = 'light') {
  const isDark = theme === 'dark';
  const bg = isDark ? MODERNIST_INK : MODERNIST_PAPER;
  const stroke = isDark ? '#f5f5f5' : MODERNIST_INK;
  const border = isDark ? '#333333' : '#111111';

  const w = Number(width) || 600;
  const h = Number(height) || 200;
  const cy = h / 2;

  const parts = (reactionSmiles || '').split('>>');
  const reactantsText = escapeXml(parts[0] || 'Reactivos');
  const productsText = escapeXml(parts[1] || 'Productos');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:${bg}; border:1px solid ${border};">
      <rect x="0" y="0" width="${w}" height="${h}" fill="${bg}" />
      
      <!-- Modernist Corner Mark -->
      <rect x="0" y="0" width="8" height="8" fill="${MODERNIST_RED}" />

      <!-- Reactants Box -->
      <rect x="20" y="${cy - 50}" width="${w / 2 - 70}" height="100" fill="none" stroke="${border}" stroke-width="1" />
      <text x="35" y="${cy - 30}" font-family="'Archivo', sans-serif" font-size="9" font-weight="800" fill="${MODERNIST_RED}" letter-spacing="1">REACTIVOS</text>
      <text x="35" y="${cy + 8}" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="${stroke}">
        ${reactantsText.length > 32 ? reactantsText.slice(0, 29) + '...' : reactantsText}
      </text>

      <!-- Center Architectural Reaction Arrow -->
      <g stroke="${MODERNIST_RED}" stroke-width="2.5" fill="none" stroke-linecap="square">
        <line x1="${w / 2 - 35}" y1="${cy}" x2="${w / 2 + 35}" y2="${cy}" />
        <polyline points="${w / 2 + 23},${cy - 7} ${w / 2 + 35},${cy} ${w / 2 + 23},${cy + 7}" fill="none" />
      </g>
      ${reagents ? `
        <text x="${w / 2}" y="${cy - 12}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" fill="${stroke}">
          ${escapeXml(reagents)}
        </text>
      ` : ''}

      <!-- Products Box -->
      <rect x="${w / 2 + 50}" y="${cy - 50}" width="${w / 2 - 70}" height="100" fill="none" stroke="${border}" stroke-width="1" />
      <text x="${w / 2 + 65}" y="${cy - 30}" font-family="'Archivo', sans-serif" font-size="9" font-weight="800" fill="${MODERNIST_RED}" letter-spacing="1">PRODUCTO</text>
      <text x="${w / 2 + 65}" y="${cy + 8}" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="${stroke}">
        ${productsText.length > 32 ? productsText.slice(0, 29) + '...' : productsText}
      </text>
    </svg>
  `.trim();
}

function escapeXml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ==========================================================================
// Pharmacophore Library & Automatic Smart Mapper for QFDOS Fármacos
// ==========================================================================
export const COMMON_PHARMACOPHORES = {
  aryloxypropanolamine: {
    name: 'Ariloxipropanolamina (β-bloqueantes)',
    smarts: '[#6]~[#6]-[#8]-[#6]-[#6](-[#8])-[#6]-[#7]',
    description: 'Cadena Ariloxi-2-propanolamina esencial para afinidad β-adrenérgica (Propranolol, Atenolol).'
  },
  catecholamine: {
    name: 'Catecol / Feniletanolamina (Adrenérgicos)',
    smarts: 'c1c(O)c(O)ccc1[#6]([#8])[#6][#7]',
    description: 'Anillo dihidroxibencénico y grupo β-hidroxietilamino (Salbutamol, Adrenalina).'
  },
  dihydropyridine: {
    name: 'Núcleo 1,4-Dihidropiridina (DHP)',
    smarts: 'C1=C(C)NC(C)=C1',
    description: 'Heterociclo 1,4-DHP con sustituyente arilo en C4 (Nifedipino, Amlodipino).'
  },
  benzodiazepine: {
    name: 'Núcleo 1,4-Benzodiazepina',
    smarts: 'c1ccc2c(c1)N',
    description: 'Anillo bencénico fusionado a diazepina modulador de GABA-A (Diazepam).'
  },
  morphinan: {
    name: 'Núcleo 4,5-Epoximorfinano (Opioides)',
    smarts: 'c1ccccc1',
    description: 'Sistema rígido fenantrénico con nitrógeno básico terciario (Morfina, Fentanilo).'
  },
  fluoroquinolone: {
    name: '4-Quinolona-3-Carboxílico',
    smarts: 'c1cc2c(=O)c(C(=O)O)cn',
    description: 'Ácido 4-oxo-1,4-dihidroquinolina-3-carboxílico (Ciprofloxacino).'
  },
  protonPumpInhibitor: {
    name: 'Sulfinil-benzimidazol (IBP)',
    smarts: 'c1nc2ccccc2[nH]1',
    description: 'Núcleo benzimidazol unido por sulfinilo a piridina (Omeprazol).'
  },
  aceInhibitor: {
    name: 'Quelante de Zn²⁺ / Carboxilato (IECA)',
    smarts: 'C(=O)O',
    description: 'Grupo coordinante de zinc en el sitio catalítico de ECA (Captopril, Enalapril).'
  },
  nsaidPropionic: {
    name: 'Ácido Arilpropiónico (AINEs)',
    smarts: 'c1ccccc1C(C)C(=O)O',
    description: 'Ácido 2-arilpropiónico inhibidor de COX (Ibuprofeno).'
  },
  benzylpiperidine: {
    name: 'Bencilpiperidina (AChE)',
    smarts: 'C1CCN(CC1)Cc2ccccc2',
    description: 'Unidad bencilpiperidina de unión al sitio aniónico de AChE (Donepezilo).'
  }
};

/**
 * Returns the most relevant pharmacophore SMARTS for a given drug name or SMILES.
 */
export function getPharmacophoreForDrug(drugName, smiles) {
  const name = (drugName || '').toLowerCase();
  
  if (name.includes('propranolol') || name.includes('atenolol') || name.includes('timolol') || name.includes('metoprolol')) {
    return COMMON_PHARMACOPHORES.aryloxypropanolamine;
  }
  if (name.includes('salbutamol') || name.includes('adrenalina') || name.includes('isoprenalina')) {
    return COMMON_PHARMACOPHORES.catecholamine;
  }
  if (name.includes('nifedipino') || name.includes('amlodipino') || name.includes('dhpp')) {
    return COMMON_PHARMACOPHORES.dihydropyridine;
  }
  if (name.includes('donepezilo')) {
    return COMMON_PHARMACOPHORES.benzylpiperidine;
  }
  if (name.includes('diazepam') || name.includes('flumazenil') || name.includes('zolpidem')) {
    return COMMON_PHARMACOPHORES.benzodiazepine;
  }
  if (name.includes('morfina') || name.includes('fentanilo') || name.includes('naloxona')) {
    return COMMON_PHARMACOPHORES.morphinan;
  }
  if (name.includes('ciprofloxacino') || name.includes('levofloxacino')) {
    return COMMON_PHARMACOPHORES.fluoroquinolone;
  }
  if (name.includes('omeprazol') || name.includes('pantoprazol') || name.includes('esomeprazol')) {
    return COMMON_PHARMACOPHORES.protonPumpInhibitor;
  }
  if (name.includes('captopril') || name.includes('enalapril') || name.includes('lisinopril')) {
    return COMMON_PHARMACOPHORES.aceInhibitor;
  }
  if (name.includes('ibuprofeno') || name.includes('naproxeno') || name.includes('ketoprofeno')) {
    return COMMON_PHARMACOPHORES.nsaidPropionic;
  }

  // Fallback: search for carboxylate or aromatic ring
  if (smiles && smiles.includes('C(=O)O')) {
    return { name: 'Grupo Carboxilato Farmacofórico', smarts: 'C(=O)O', description: 'Grupo carboxilato donador/aceptor iónico.' };
  }
  return { name: 'Núcleo Aromático Lipófilo', smarts: 'c1ccccc1', description: 'Región aromática de anclaje hidrofóbico.' };
}

// Expose on window for direct browser script access
const RDKIT_ENGINE = {
  initRDKit,
  getRDKit,
  renderMoleculeSvg,
  renderReactionSvg,
  computeDescriptors,
  evaluateLipinskiVeber,
  calculateTanimoto,
  findSubstructureMatches,
  COMMON_PHARMACOPHORES,
  getPharmacophoreForDrug,
  generateFallbackSvg,
  generateFallbackReactionSvg,
  MODERNIST_RED,
  MODERNIST_RED_RGBA,
  MODERNIST_INK,
  MODERNIST_PAPER
};

if (typeof window !== 'undefined') {
  window.RDKIT_ENGINE = RDKIT_ENGINE;
}

export default RDKIT_ENGINE;

