/**
 * ============================================================================
 * QFDOS v4 Modernist — PubChem PUG REST API Client
 * Specification: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 * ============================================================================
 */

const PUG_REST_BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';

const PROPERTY_TAGS = [
  'MolecularFormula',
  'MolecularWeight',
  'CanonicalSMILES',
  'IsomericSMILES',
  'InChI',
  'InChIKey',
  'IUPACName',
  'XLogP',
  'ExactMass',
  'TPSA',
  'Complexity',
  'HBondDonorCount',
  'HBondAcceptorCount',
  'RotatableBondCount',
  'HeavyAtomCount'
].join(',');

// In-memory caches to respect NCBI request limits (< 5 req/s)
const propertyCache = new Map();
const autocompleteCache = new Map();
const descriptionCache = new Map();
const synonymCache = new Map();

function parsePubChemItem(item, customName) {
  const smiles = item.CanonicalSMILES || item.ConnectivitySMILES || item.SMILES || item.IsomericSMILES || '';
  const mw = item.MolecularWeight ? parseFloat(item.MolecularWeight) : undefined;
  const xlogp = item.XLogP !== undefined ? parseFloat(item.XLogP) : undefined;
  const tpsa = item.TPSA !== undefined ? parseFloat(item.TPSA) : undefined;
  const hbd = item.HBondDonorCount !== undefined ? parseInt(item.HBondDonorCount) : 0;
  const hba = item.HBondAcceptorCount !== undefined ? parseInt(item.HBondAcceptorCount) : 0;
  const rotBonds = item.RotatableBondCount !== undefined ? parseInt(item.RotatableBondCount) : 0;

  return {
    cid: item.CID,
    name: customName || item.IUPACName || `CID-${item.CID}`,
    iupacName: item.IUPACName,
    molecularFormula: item.MolecularFormula,
    molecularWeight: mw,
    canonicalSmiles: smiles,
    isomericSmiles: item.IsomericSMILES || smiles,
    inchi: item.InChI,
    inchiKey: item.InChIKey,
    xlogp: xlogp,
    exactMass: item.ExactMass ? parseFloat(item.ExactMass) : undefined,
    tpsa: tpsa,
    complexity: item.Complexity !== undefined ? parseFloat(item.Complexity) : undefined,
    hbd: hbd,
    hba: hba,
    rotatableBonds: rotBonds,
    heavyAtoms: item.HeavyAtomCount !== undefined ? parseInt(item.HeavyAtomCount) : undefined,
    lipinski: evaluateLipinski({ mw, xlogp, hbd, hba }),
    veber: evaluateVeber({ rotBonds, tpsa })
  };
}

export function evaluateLipinski({ mw, xlogp, hbd, hba }) {
  const mwValid = mw === undefined || mw <= 500;
  const logPValid = xlogp === undefined || xlogp <= 5.0;
  const hbdValid = hbd === undefined || hbd <= 5;
  const hbaValid = hba === undefined || hba <= 10;

  let violations = 0;
  if (!mwValid) violations++;
  if (!logPValid) violations++;
  if (!hbdValid) violations++;
  if (!hbaValid) violations++;

  return {
    mwValid,
    logPValid,
    hbdValid,
    hbaValid,
    violations,
    isCompliant: violations <= 1
  };
}

export function evaluateVeber({ rotBonds, tpsa }) {
  const rotBondsValid = rotBonds === undefined || rotBonds <= 10;
  const tpsaValid = tpsa === undefined || tpsa <= 140;

  let violations = 0;
  if (!rotBondsValid) violations++;
  if (!tpsaValid) violations++;

  return {
    rotBondsValid,
    tpsaValid,
    violations,
    isCompliant: violations === 0
  };
}

/**
 * Autocompletado en vivo de nombres de fármacos desde PubChem
 */
export async function fetchPubChemAutocomplete(term, limit = 8, signal) {
  const clean = (term || '').trim();
  if (!clean || clean.length < 2) return [];

  const cacheKey = `auto:${clean.toLowerCase()}:${limit}`;
  if (autocompleteCache.has(cacheKey)) return autocompleteCache.get(cacheKey);

  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(clean)}/json?limit=${limit}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.dictionary_terms?.compound || [];
    autocompleteCache.set(cacheKey, list);
    return list;
  } catch (e) {
    return [];
  }
}

/**
 * Buscar compuesto en PubChem por Nombre (genérico o comercial)
 */
export async function searchPubChemByName(name, signal) {
  const clean = (name || '').trim();
  if (!clean) return null;

  const cacheKey = `name:${clean.toLowerCase()}`;
  if (propertyCache.has(cacheKey)) return propertyCache.get(cacheKey);

  const url = `${PUG_REST_BASE}/compound/name/${encodeURIComponent(clean)}/property/${PROPERTY_TAGS}/JSON`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      if (res.status === 404) {
        // Fallback a autocompletado si hay ligeras variaciones de nombre
        const suggestions = await fetchPubChemAutocomplete(clean, 3, signal);
        if (suggestions.length && suggestions[0].toLowerCase() !== clean.toLowerCase()) {
          return searchPubChemByName(suggestions[0], signal);
        }
      }
      return null;
    }
    const data = await res.json();
    const prop = data?.PropertyTable?.Properties?.[0];
    if (!prop) return null;

    const parsed = parsePubChemItem(prop, clean);
    propertyCache.set(cacheKey, parsed);
    if (parsed.cid) propertyCache.set(`cid:${parsed.cid}`, parsed);
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Buscar compuesto en PubChem por estructura SMILES
 */
export async function searchPubChemBySmiles(smiles, signal) {
  const clean = (smiles || '').trim();
  if (!clean) return null;

  const cacheKey = `smiles:${clean}`;
  if (propertyCache.has(cacheKey)) return propertyCache.get(cacheKey);

  const url = `${PUG_REST_BASE}/compound/smiles/${encodeURIComponent(clean)}/property/${PROPERTY_TAGS}/JSON`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const prop = data?.PropertyTable?.Properties?.[0];
    if (!prop) return null;

    const parsed = parsePubChemItem(prop);
    propertyCache.set(cacheKey, parsed);
    if (parsed.cid) propertyCache.set(`cid:${parsed.cid}`, parsed);
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Buscar compuesto por CID numérico
 */
export async function searchPubChemByCid(cid, signal) {
  if (!cid) return null;
  const cacheKey = `cid:${cid}`;
  if (propertyCache.has(cacheKey)) return propertyCache.get(cacheKey);

  const url = `${PUG_REST_BASE}/compound/cid/${cid}/property/${PROPERTY_TAGS}/JSON`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const prop = data?.PropertyTable?.Properties?.[0];
    if (!prop) return null;

    const parsed = parsePubChemItem(prop);
    propertyCache.set(cacheKey, parsed);
    return parsed;
  } catch (e) {
    return null;
  }
}

/**
 * Obtener descripción farmacológica oficial desde NLM / ChEBI / FDA
 */
export async function fetchCompoundDescription(cid, signal) {
  if (!cid) return null;
  if (descriptionCache.has(cid)) return descriptionCache.get(cid);

  const url = `${PUG_REST_BASE}/compound/cid/${cid}/description/JSON`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const infos = data?.InformationList?.Information || [];
    
    // Filtrar la información que tenga descripción sustancial
    const found = infos.find(i => i.Description && i.Description.length > 30) || infos[0];
    const desc = found ? {
      title: found.Title,
      description: found.Description,
      sourceName: found.DescriptionSourceName,
      sourceUrl: found.DescriptionURL
    } : null;

    descriptionCache.set(cid, desc);
    return desc;
  } catch (e) {
    return null;
  }
}

/**
 * Obtener sinónimos y nombres comerciales internacionales
 */
export async function fetchCompoundSynonyms(cid, limit = 12, signal) {
  if (!cid) return [];
  if (synonymCache.has(cid)) return synonymCache.get(cid);

  const url = `${PUG_REST_BASE}/compound/cid/${cid}/synonyms/JSON`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const raw = data?.InformationList?.Information?.[0]?.Synonym || [];

    // Limpiar códigos de barras y números de patentes internos
    const filtered = raw
      .filter(s => s && s.length > 2 && s.length < 35 && !/^\d+-\d+-\d+$/.test(s) && !/^[A-Z0-9]{8,}$/.test(s))
      .slice(0, limit);

    synonymCache.set(cid, filtered);
    return filtered;
  } catch (e) {
    return [];
  }
}

/**
 * URLs de visualización directa
 */
export function getPubChem2DImageUrl(cid, size = '300x300') {
  if (!cid) return '';
  return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=${size}`;
}

export function getPubChem3DConformerUrl(cid) {
  if (!cid) return '';
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=3D-Conformer`;
}

export function getMolViewUrl(smiles) {
  if (!smiles) return 'https://molview.org';
  return `https://molview.org/?smiles=${encodeURIComponent(smiles)}`;
}

export function getPubChemUrl(cid) {
  if (!cid) return 'https://pubchem.ncbi.nlm.nih.gov';
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}

// Global browser attachment
if (typeof window !== 'undefined') {
  window.PUBCHEM_SERVICE = {
    searchPubChemByName,
    searchPubChemBySmiles,
    searchPubChemByCid,
    fetchPubChemAutocomplete,
    fetchCompoundDescription,
    fetchCompoundSynonyms,
    getPubChem2DImageUrl,
    getPubChem3DConformerUrl,
    getMolViewUrl,
    getPubChemUrl,
    evaluateLipinski,
    evaluateVeber
  };
}
