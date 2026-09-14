// ==========================================================================
// QFDOS v4 Modernist Chemical 2D Structure Renderer
// Renders 2D vector chemical structures via RDKit MinimalLib (WASM)
// with architectural fallback SVG renderer.
// ==========================================================================

let rdkitInstance = null;
let rdkitLoadingPromise = null;

export function initRDKit() {
  if (rdkitInstance) return Promise.resolve(rdkitInstance);
  if (rdkitLoadingPromise) return rdkitLoadingPromise;

  rdkitLoadingPromise = new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.RDKit) {
      rdkitInstance = window.RDKit;
      return resolve(rdkitInstance);
    }
    if (typeof window !== 'undefined' && typeof window.initRDKitModule === 'function') {
      window.initRDKitModule({
        print: () => {},
        printErr: () => {}
      }).then(instance => {
        window.RDKit = instance;
        rdkitInstance = instance;
        resolve(instance);
      }).catch(err => {
        console.warn('RDKit WASM load warning, using fallback:', err);
        resolve(null);
      });
      return;
    }
    // Poll for a brief time if script tag is still loading
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (typeof window !== 'undefined' && typeof window.initRDKitModule === 'function') {
        clearInterval(interval);
        window.initRDKitModule({
          print: () => {},
          printErr: () => {}
        }).then(instance => {
          window.RDKit = instance;
          rdkitInstance = instance;
          resolve(instance);
        }).catch(() => resolve(null));
      } else if (attempts > 20) {
        clearInterval(interval);
        resolve(null);
      }
    }, 150);
  });

  return rdkitLoadingPromise;
}

/**
 * Render a 2D molecule structure into an SVG string.
 * Uses RDKit MinimalLib if available; otherwise returns clean architectural SVG fallback.
 */
export async function renderMoleculeSvg(smiles, width = 240, height = 160) {
  if (!smiles) return null;

  try {
    const rdkit = await initRDKit();
    if (rdkit) {
      const mol = rdkit.get_mol(smiles);
      if (mol) {
        // Modernist architectural style: black bonds, crisp lines
        const details = JSON.stringify({
          width,
          height,
          bondLineWidth: 2.0,
          addStereoAnnotation: true,
          clearBackground: true
        });
        const svg = mol.get_svg_with_highlights ? mol.get_svg_with_highlights(details) : mol.get_svg(width, height);
        mol.delete();
        return svg;
      }
    }
  } catch (e) {
    console.warn('RDKit render error, falling back:', e);
  }

  // Architectural fallback SVG with stylized formula and SMILES notation
  return generateFallbackSvg(smiles, width, height);
}

function generateFallbackSvg(smiles, width, height) {
  const safeSmiles = smiles.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:#ffffff; border:1px solid #111111;">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
      <g stroke="#111111" stroke-width="2" fill="none">
        <!-- Stylized aromatic hexagon -->
        <polygon points="${width/2 - 30},${height/2 - 15} ${width/2},${height/2 - 32} ${width/2 + 30},${height/2 - 15} ${width/2 + 30},${height/2 + 20} ${width/2},${height/2 + 37} ${width/2 - 30},${height/2 + 20}" />
        <circle cx="${width/2}" cy="${height/2 + 2}" r="16" stroke="#111111" stroke-dasharray="4,4" />
        <line x1="${width/2 + 30}" y1="${height/2 - 15}" x2="${width/2 + 55}" y2="${height/2 - 30}" />
        <line x1="${width/2 - 30}" y1="${height/2 - 15}" x2="${width/2 - 55}" y2="${height/2 - 30}" />
      </g>
      <text x="${width/2}" y="${height - 12}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="9" fill="#111111" font-weight="600">
        ${safeSmiles.length > 28 ? safeSmiles.slice(0, 25) + '...' : safeSmiles}
      </text>
    </svg>
  `;
}
