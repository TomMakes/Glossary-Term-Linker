function hasFile(e: DragEvent): boolean {
  const items = e.dataTransfer?.items;
  return !!items && [...items].some((it) => it.kind === 'file');
}

/** Wires drag-enter/over/leave/drop on a zone: highlights it and forwards the dropped file. */
export function setupDropZone(el: HTMLElement, onFile: (file: File) => void): void {
  el.addEventListener('dragenter', (e) => {
    if (hasFile(e)) e.preventDefault();
  });
  el.addEventListener('dragover', (e) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
    el.classList.add('drag-over');
  });
  el.addEventListener('dragleave', (e) => {
    if (el.contains(e.relatedTarget as Node)) return;
    el.classList.remove('drag-over');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    let file: File | null = null;
    if (e.dataTransfer?.items?.length) {
      for (const it of e.dataTransfer.items) {
        if (it.kind === 'file') {
          file = it.getAsFile();
          break;
        }
      }
    }
    if (!file && e.dataTransfer?.files?.length) file = e.dataTransfer.files[0];
    if (file) onFile(file);
  });
}

/**
 * Window-level guard: only calls preventDefault when a FILE is being dragged
 * (and only sets dropEffect='none' outside the given zones), so the browser
 * never navigates to / downloads a file dropped in empty page space.
 */
export function installWindowDropGuard(zones: HTMLElement[]): void {
  window.addEventListener('dragover', (e) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    const inZone = zones.some((z) => z.contains(e.target as Node));
    if (!inZone) e.dataTransfer!.dropEffect = 'none';
  });
  window.addEventListener('drop', (e) => {
    if (hasFile(e)) e.preventDefault();
  });
}
