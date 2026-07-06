import type { GlossaryTerm } from './csv';

export type ReplaceOptions = {
  matchPlurals: boolean;
  newTab: boolean;
  firstMatchOnlyPerTerm: boolean;
};

type VariantInfo = { term: string; link: string };

type ReplaceContext = {
  re: RegExp | null;
  counts: Record<string, number>;
  map: Map<string, VariantInfo>;
  matchedTerms: Set<string>;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/** Adds a plural variant: ...y -> ...ies (after a consonant), sibilants -> ...es, else -> ...s. */
function pluralForms(term: string, matchPlurals: boolean): string[] {
  const forms = [term];
  if (matchPlurals) {
    if (/[^aeiou]y$/i.test(term)) forms.push(term.slice(0, -1) + 'ies');
    else if (/(s|x|z|ch|sh)$/i.test(term)) forms.push(term + 'es');
    else forms.push(term + 's');
  }
  return forms;
}

/**
 * Builds a single case-insensitive regex over every term + plural variant.
 * Variants are deduplicated case-insensitively, then sorted longest-first so
 * longer phrases win over their substrings. Lookarounds approximate word
 * boundaries so partial-word matches are avoided.
 */
export function buildReplacer(terms: GlossaryTerm[], options: ReplaceOptions): ReplaceContext {
  const counts: Record<string, number> = {};
  const map = new Map<string, VariantInfo>();
  const variants: string[] = [];

  terms.forEach((t) => {
    counts[t.term] = 0;
  });
  terms.forEach((t) => {
    pluralForms(t.term, options.matchPlurals).forEach((form) => {
      const key = form.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { term: t.term, link: t.link });
        variants.push(form);
      }
    });
  });

  variants.sort((a, b) => b.length - a.length);
  if (variants.length === 0) return { re: null, counts, map, matchedTerms: new Set<string>() };

  const pattern = variants.map(escapeRegex).join('|');
  const re = new RegExp('(?<![A-Za-z0-9_])(' + pattern + ')(?![A-Za-z0-9_])', 'gi');
  return { re, counts, map, matchedTerms: new Set<string>() };
}

function replaceInText(text: string, ctx: ReplaceContext, options: ReplaceOptions): string {
  if (!ctx.re) return text;
  const target = options.newTab ? ' target="_blank" rel="noopener"' : '';
  return text.replace(ctx.re, (m) => {
    const info = ctx.map.get(m.toLowerCase());
    if (!info) return m;
    if (options.firstMatchOnlyPerTerm && ctx.matchedTerms.has(info.term)) return m;
    ctx.counts[info.term] = (ctx.counts[info.term] || 0) + 1;
    if (options.firstMatchOnlyPerTerm) {
      ctx.matchedTerms.add(info.term);
    }
    return '<a href="' + escapeAttr(info.link) + '"' + target + '>' + m + '</a>';
  });
}

export type ReplaceResult = { output: string; counts: Record<string, number> };

const PROTECT = new Set(['a', 'code']);
const RAW = new Set(['script', 'style']);

function tagName(tag: string): string {
  const m = tag.match(/^<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)/);
  return m ? m[1].toLowerCase() : '';
}

/**
 * Manual tokenizer over the raw HTML string. Copies comments and the full
 * contents of <script>/<style> verbatim, tracks nesting depth of <a>/<code>
 * to avoid nested links or linking code, and only runs the replacement
 * regex on text nodes outside tags/attributes.
 */
export function runReplace(html: string, terms: GlossaryTerm[], options: ReplaceOptions): ReplaceResult {
  const ctx = buildReplacer(terms, options);
  let out = '';
  let i = 0;
  const n = html.length;
  let depth = 0;

  while (i < n) {
    const c = html[i];
    if (c === '<') {
      if (html.startsWith('<!--', i)) {
        const end = html.indexOf('-->', i + 4);
        const stop = end === -1 ? n : end + 3;
        out += html.slice(i, stop);
        i = stop;
        continue;
      }

      const end = html.indexOf('>', i);
      if (end === -1) {
        out += html.slice(i);
        break;
      }
      const tag = html.slice(i, end + 1);
      out += tag;
      const tn = tagName(tag);
      const isClose = /^<\s*\//.test(tag);
      const selfClose = /\/>\s*$/.test(tag);

      if (!isClose && !selfClose && RAW.has(tn)) {
        const closeRe = new RegExp('</\\s*' + tn + '\\s*>', 'i');
        const rest = html.slice(end + 1);
        const m = rest.match(closeRe);
        if (m) {
          const cend = end + 1 + (m.index ?? 0) + m[0].length;
          out += html.slice(end + 1, cend);
          i = cend;
          continue;
        } else {
          out += html.slice(end + 1);
          break;
        }
      }

      if (!selfClose && PROTECT.has(tn)) {
        depth = isClose ? Math.max(0, depth - 1) : depth + 1;
      }
      i = end + 1;
      continue;
    } else {
      let j = html.indexOf('<', i);
      if (j === -1) j = n;
      const text = html.slice(i, j);
      out += depth > 0 ? text : replaceInText(text, ctx, options);
      i = j;
      continue;
    }
  }

  return { output: out, counts: ctx.counts };
}
