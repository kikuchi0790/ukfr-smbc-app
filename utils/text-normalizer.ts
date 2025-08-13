export interface TextQuoteSelector {
  exact: string;
  prefix?: string;
  suffix?: string;
}

export function normalizeText(input: string): string {
  if (!input) return '';
  let s = input;
  s = s.replace(/\r\n?|\n/g, ' ');
  s = s.toLowerCase();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/(\w)-\s+(\w)/g, '$1$2');
  return s.trim();
}

export function applyAliasExpansion(input: string, aliasMap: Record<string, string>): string {
  const norm = normalizeText(input);
  let out = norm;
  for (const [alias, canonical] of Object.entries(aliasMap)) {
    const a = normalizeText(alias);
    const c = normalizeText(canonical);
    if (!a || !c) continue;
    const re = new RegExp(`\\b${escapeRegExp(a)}\\b`, 'g');
    out = out.replace(re, c);
  }
  return out;
}

export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchTextQuote(haystack: string, selector: TextQuoteSelector): number | null {
  const normHay = normalizeText(haystack);
  const normExact = normalizeText(selector.exact || '');
  if (!normExact) return null;
  // Try exact first
  let idx = normHay.indexOf(normExact);
  if (idx !== -1) return idx;
  // Try prefix/suffix assisted search
  const prefix = selector.prefix ? normalizeText(selector.prefix) : '';
  const suffix = selector.suffix ? normalizeText(selector.suffix) : '';
  if (prefix) {
    const preIdx = normHay.indexOf(prefix);
    if (preIdx !== -1) {
      const start = preIdx + prefix.length;
      const cand = normHay.indexOf(normExact, start);
      if (cand !== -1) return cand;
    }
  }
  if (suffix) {
    const sufIdx = normHay.indexOf(suffix);
    if (sufIdx !== -1) {
      const cand = normHay.lastIndexOf(normExact, sufIdx);
      if (cand !== -1) return cand;
    }
  }
  return null;
}


