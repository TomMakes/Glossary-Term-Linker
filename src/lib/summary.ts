import type { GlossaryTerm } from './csv';
import { runReplace, type ReplaceOptions } from './replacer';

export type MatchedTerm = { term: string; link: string; count: number; label: string };
export type NoMatchTerm = { term: string };

export type LinkResult = {
  output: string;
  matched: MatchedTerm[];
  noMatch: NoMatchTerm[];
  hasMatched: boolean;
  hasNoMatch: boolean;
  totalReplacements: number;
  totalLabel: string;
  subtitle: string;
  outName: string;
  skipped: number;
  hasSkipped: boolean;
  skippedLabel: string;
};

/** Runs the replacement engine and shapes the result for display + download. */
export function buildLinkResult(
  html: string,
  terms: GlossaryTerm[],
  htmlName: string,
  csvSkipped: number,
  options: ReplaceOptions,
): LinkResult {
  const { output, counts } = runReplace(html, terms, options);

  const matched: MatchedTerm[] = [];
  const noMatch: NoMatchTerm[] = [];
  let total = 0;

  terms.forEach((t) => {
    const c = counts[t.term] || 0;
    total += c;
    if (c > 0) matched.push({ term: t.term, link: t.link, count: c, label: c + (c === 1 ? ' link' : ' links') });
    else noMatch.push({ term: t.term });
  });
  matched.sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));

  const base = htmlName.replace(/\.(html?|txt)$/i, '');

  return {
    output,
    matched,
    noMatch,
    hasMatched: matched.length > 0,
    hasNoMatch: noMatch.length > 0,
    totalReplacements: total,
    totalLabel: total === 1 ? 'hyperlink inserted' : 'hyperlinks inserted',
    subtitle: terms.length + ' terms · ' + matched.length + ' matched',
    outName: base + '-linked.html',
    skipped: csvSkipped,
    hasSkipped: csvSkipped > 0,
    skippedLabel: csvSkipped + (csvSkipped === 1 ? ' malformed CSV row was skipped' : ' malformed CSV rows were skipped'),
  };
}
