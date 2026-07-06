export type Theme = 'light' | 'dark';

const SUN_ICON = `<svg width="17" height="17" viewBox="0 0 18 18"><circle cx="9" cy="9" r="4.5" fill="currentColor"></circle><g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="9" y1="1" x2="9" y2="3"></line><line x1="9" y1="15" x2="9" y2="17"></line><line x1="1" y1="9" x2="3" y2="9"></line><line x1="15" y1="9" x2="17" y2="9"></line><line x1="3.3" y1="3.3" x2="4.7" y2="4.7"></line><line x1="13.3" y1="13.3" x2="14.7" y2="14.7"></line><line x1="3.3" y1="14.7" x2="4.7" y2="13.3"></line><line x1="13.3" y1="4.7" x2="14.7" y2="3.3"></line></g></svg>`;
const MOON_ICON = `<svg width="17" height="17" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6.5" fill="currentColor"></circle><circle cx="11.5" cy="6.5" r="5.5" fill="var(--surface)"></circle></svg>`;

/** Reads the initial theme from the OS preference. */
export function detectInitialTheme(): Theme {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

/** Applies the theme to the root element and updates the toggle button label
 * (the button shows the mode you'd switch *to*, not the current mode). */
export function applyTheme(theme: Theme, toggleContent: HTMLElement): void {
  document.documentElement.setAttribute('data-theme', theme);
  toggleContent.innerHTML =
    theme === 'dark'
      ? `<span class="theme-toggle-icon-label">${SUN_ICON}Light</span>`
      : `<span class="theme-toggle-icon-label">${MOON_ICON}Dark</span>`;
}
