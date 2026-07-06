// import './style.css';
import type { GlossaryTerm } from './lib/csv';
import { parseGlossary } from './lib/csv';
import { buildLinkResult, type LinkResult } from './lib/summary';
import { fmtBytes } from './lib/format';
import { setupDropZone, installWindowDropGuard } from './lib/dropzone';
import { detectInitialTheme, applyTheme, type Theme } from './theme';

// Constants exposed as "props" in the design prototype; left as fixed
// settings here since this tool isn't expected to grow configurability.
const MATCH_PLURALS = true;
const NEW_TAB = false;

type ErrorCode = 'notcsv' | 'nothtml' | 'empty' | 'read' | 'headers' | 'norows' | 'process';

const ERROR_TEXT: Record<ErrorCode, string> = {
  notcsv: 'That doesn’t look like a CSV file. Please upload a .csv file.',
  nothtml: 'Unsupported file type. Please upload an .html, .htm or .txt file.',
  empty: 'This file is empty — nothing to read.',
  read: 'Couldn’t read this file. Please try another.',
  headers: 'CSV is missing required columns. It needs a header row with “term” and “link”.',
  norows: 'No valid glossary rows found — every row is missing a term or a link.',
  process: 'Something went wrong while processing this page. Please check the file and try again.',
};

type State = {
  theme: Theme;
  firstMatchOnlyPerTerm: boolean;
  csvName: string | null;
  csvError: ErrorCode | null;
  csvTerms: GlossaryTerm[] | null;
  csvSkipped: number;
  htmlName: string | null;
  htmlError: ErrorCode | null;
  htmlContent: string | null;
  htmlBytes: number;
  processing: boolean;
  result: LinkResult | null;
};

const state: State = {
  theme: detectInitialTheme(),
  firstMatchOnlyPerTerm: false,
  csvName: null,
  csvError: null,
  csvTerms: null,
  csvSkipped: 0,
  htmlName: null,
  htmlError: null,
  htmlContent: null,
  htmlBytes: 0,
  processing: false,
  result: null,
};

// ---------- DOM references ----------
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const themeToggleContent = document.getElementById('theme-toggle-content') as HTMLElement;

const csvZone = document.getElementById('csv-zone') as HTMLElement;
const csvInput = document.getElementById('csv-input') as HTMLInputElement;
const csvBody = document.getElementById('csv-body') as HTMLElement;
const csvErrorStrip = document.getElementById('csv-error') as HTMLElement;
const csvErrorText = document.getElementById('csv-error-text') as HTMLElement;

const htmlZone = document.getElementById('html-zone') as HTMLElement;
const htmlInput = document.getElementById('html-input') as HTMLInputElement;
const htmlBody = document.getElementById('html-body') as HTMLElement;
const htmlErrorStrip = document.getElementById('html-error') as HTMLElement;
const htmlErrorText = document.getElementById('html-error-text') as HTMLElement;
const matchModeToggle = document.getElementById('match-mode-toggle') as HTMLButtonElement;
const matchModeText = document.getElementById('match-mode-text') as HTMLElement;

const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const downloadRow = document.getElementById('download-row') as HTMLElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;

const resultsCard = document.getElementById('results-card') as HTMLElement;
const resultSubtitle = document.getElementById('result-subtitle') as HTMLElement;
const totalCount = document.getElementById('total-count') as HTMLElement;
const totalLabel = document.getElementById('total-label') as HTMLElement;
const matchedSection = document.getElementById('matched-section') as HTMLElement;
const matchedList = document.getElementById('matched-list') as HTMLElement;
const nomatchSection = document.getElementById('nomatch-section') as HTMLElement;
const nomatchChips = document.getElementById('nomatch-chips') as HTMLElement;
const skippedNote = document.getElementById('skipped-note') as HTMLElement;
const skippedText = document.getElementById('skipped-text') as HTMLElement;

// ---------- file reading ----------
function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function loadCsv(file: File): Promise<void> {
  const nameOk = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  state.csvName = file.name;
  state.csvTerms = null;
  state.csvSkipped = 0;
  state.result = null;

  if (!nameOk) {
    state.csvError = 'notcsv';
    render();
    return;
  }

  let text: string;
  try {
    text = await readFile(file);
  } catch {
    state.csvError = 'read';
    render();
    return;
  }
  if (!text || !text.trim()) {
    state.csvError = 'empty';
    render();
    return;
  }

  const parsed = parseGlossary(text);
  if (!parsed.ok) {
    state.csvError = parsed.error;
    render();
    return;
  }

  state.csvTerms = parsed.terms;
  state.csvSkipped = parsed.skipped;
  state.csvError = null;
  render();
}

async function loadHtml(file: File): Promise<void> {
  const nameOk = /\.(html?|txt)$/i.test(file.name) || file.type === 'text/html' || file.type === 'text/plain';
  state.htmlName = file.name;
  state.htmlContent = null;
  state.result = null;

  if (!nameOk) {
    state.htmlError = 'nothtml';
    render();
    return;
  }

  let text: string;
  try {
    text = await readFile(file);
  } catch {
    state.htmlError = 'read';
    render();
    return;
  }
  if (!text || !text.trim()) {
    state.htmlBytes = 0;
    state.htmlError = 'empty';
    render();
    return;
  }

  state.htmlContent = text;
  state.htmlBytes = text.length;
  state.htmlError = null;
  render();
}

// ---------- actions ----------
function canStart(): boolean {
  return !!state.csvTerms && !!state.htmlContent && !state.csvError && !state.htmlError && !state.processing;
}

function onStart(): void {
  if (!canStart()) return;
  state.processing = true;
  render();

  // Small delay so the "Working…" label paints before the (synchronous) run.
  setTimeout(() => {
    try {
      const result = buildLinkResult(state.htmlContent!, state.csvTerms!, state.htmlName!, state.csvSkipped, {
        matchPlurals: MATCH_PLURALS,
        newTab: NEW_TAB,
        firstMatchOnlyPerTerm: state.firstMatchOnlyPerTerm,
      });
      state.processing = false;
      state.result = result;
    } catch {
      state.processing = false;
      state.htmlError = 'process';
    }
    render();
  }, 30);
}

function onDownload(): void {
  const result = state.result;
  if (!result) return;
  const blob = new Blob([result.output], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.outName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function onToggleTheme(): void {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  render();
}

function onToggleMatchMode(): void {
  state.firstMatchOnlyPerTerm = !state.firstMatchOnlyPerTerm;
  state.result = null;
  render();
}

// ---------- rendering ----------
function renderCsvZone(): void {
  if (state.csvTerms) {
    const count = state.csvTerms.length;
    csvBody.innerHTML = `
      <div class="zone-loaded">
        <div class="zone-filename">${escapeHtml(state.csvName ?? '')}</div>
        <div class="zone-meta">${count} ${count === 1 ? 'term' : 'terms'} loaded</div>
        <div class="zone-replace">click to replace</div>
      </div>`;
  } else {
    csvBody.innerHTML = `
      <div class="zone-idle">
        <div class="zone-title">Glossary CSV</div>
        <div class="zone-hint">Drop a <b>.csv</b> here, or click to browse</div>
      </div>`;
  }

  if (state.csvError) {
    csvErrorStrip.hidden = false;
    csvErrorText.textContent = ERROR_TEXT[state.csvError];
  } else {
    csvErrorStrip.hidden = true;
  }
}

function renderHtmlZone(): void {
  if (state.htmlContent) {
    htmlBody.innerHTML = `
      <div class="zone-loaded">
        <div class="zone-filename">${escapeHtml(state.htmlName ?? '')}</div>
        <div class="zone-meta">${fmtBytes(state.htmlBytes)}</div>
        <div class="zone-replace">click to replace</div>
      </div>`;
  } else {
    htmlBody.innerHTML = `
      <div class="zone-idle">
        <div class="zone-title">HTML page</div>
        <div class="zone-hint">Drop an <b>.html</b>, <b>.htm</b> or <b>.txt</b> file</div>
      </div>`;
  }

  if (state.htmlError) {
    htmlErrorStrip.hidden = false;
    htmlErrorText.textContent = ERROR_TEXT[state.htmlError];
  } else {
    htmlErrorStrip.hidden = true;
  }
}

function renderStartButton(): void {
  const ready = canStart();
  startBtn.disabled = !ready;
  startBtn.textContent = state.processing ? 'Working…' : 'Start linking';
}

function renderMatchModeToggle(): void {
  matchModeToggle.ariaPressed = String(state.firstMatchOnlyPerTerm);
  matchModeText.textContent = state.firstMatchOnlyPerTerm
    ? 'Hyperlink first instance of term'
    : 'Hyperlink every matching term';
}

function renderResults(): void {
  const result = state.result;
  resultsCard.hidden = !result;
  downloadRow.hidden = !result;
  if (!result) return;

  resultSubtitle.textContent = result.subtitle;
  totalCount.textContent = String(result.totalReplacements);
  totalLabel.textContent = result.totalLabel;

  matchedSection.hidden = !result.hasMatched;
  matchedList.replaceChildren();
  for (const item of result.matched) {
    const row = document.createElement('div');
    row.className = 'matched-row';
    row.innerHTML = `
      <div class="matched-term">
        <div class="matched-term-name">${escapeHtml(item.term)}</div>
        <div class="matched-term-link">${escapeHtml(item.link)}</div>
      </div>
      <div class="count-pill">${escapeHtml(item.label)}</div>`;
    matchedList.appendChild(row);
  }

  nomatchSection.hidden = !result.hasNoMatch;
  nomatchChips.replaceChildren();
  for (const item of result.noMatch) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = item.term;
    nomatchChips.appendChild(chip);
  }

  skippedNote.hidden = !result.hasSkipped;
  skippedText.textContent = result.skippedLabel;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function render(): void {
  applyTheme(state.theme, themeToggleContent);
  renderCsvZone();
  renderHtmlZone();
  renderMatchModeToggle();
  renderStartButton();
  renderResults();
}

// ---------- wiring ----------
themeToggle.addEventListener('click', onToggleTheme);
matchModeToggle.addEventListener('click', onToggleMatchMode);

csvZone.addEventListener('click', () => csvInput.click());
csvInput.addEventListener('change', () => {
  const file = csvInput.files?.[0];
  csvInput.value = '';
  if (file) void loadCsv(file);
});
setupDropZone(csvZone, (file) => void loadCsv(file));

htmlZone.addEventListener('click', () => htmlInput.click());
htmlInput.addEventListener('change', () => {
  const file = htmlInput.files?.[0];
  htmlInput.value = '';
  if (file) void loadHtml(file);
});
setupDropZone(htmlZone, (file) => void loadHtml(file));

installWindowDropGuard([csvZone, htmlZone]);

startBtn.addEventListener('click', onStart);
downloadBtn.addEventListener('click', onDownload);

render();
