export type GlossaryTerm = { term: string; link: string };

export type ParsedGlossary =
  | { ok: true; terms: GlossaryTerm[]; skipped: number }
  | { ok: false; error: 'empty' | 'headers' | 'norows' };

/**
 * RFC-style CSV state machine: handles quoted fields, escaped "", and
 * \r\n / \n line endings. Do not naively split on commas.
 */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const n = text.length;

  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\r') {
        // skip, \n handles the line break
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  row.push(field);
  rows.push(row);

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** Parses raw CSV text into deduplicated glossary terms, validating the header row. */
export function parseGlossary(text: string): ParsedGlossary {
  const records = parseCSV(text);
  if (records.length < 1) return { ok: false, error: 'empty' };

  const header = records[0].map((h) => (h || '').trim().toLowerCase());
  const termIdx = header.indexOf('term');
  const linkIdx = header.indexOf('link');
  if (termIdx === -1 || linkIdx === -1) return { ok: false, error: 'headers' };

  const terms: GlossaryTerm[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    const term = (row[termIdx] || '').trim();
    const link = (row[linkIdx] || '').trim();
    if (!term || !link) {
      skipped++;
      continue;
    }
    const key = term.toLowerCase();
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    seen.add(key);
    terms.push({ term, link });
  }

  if (terms.length === 0) return { ok: false, error: 'norows' };
  return { ok: true, terms, skipped };
}
