import { createEffect } from '@/core/signal';
import { cloneTemplate, DOWNLOAD_SECTION_TEMPLATE, CHUNK_ITEM_TEMPLATE } from '@/core/templates';
import { on, delegate } from '@/core/dom';
import type { VideoChunk } from '@/types/video';
import { TRANSLATIONS } from '@/constants/translations';

export interface DownloadSectionElement {
  element: HTMLElement;
  update: (chunks: VideoChunk[], isDownloading: boolean) => void;
  destroy: () => void;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const minsStr = mins < 10 ? '0' + mins : String(mins);
  const secsStr = secs < 10 ? '0' + secs : String(secs);
  return minsStr + ':' + secsStr;
};

export function createDownloadSectionElement(
  onDownloadAll: () => void,
  onDownloadSingle: (chunk: VideoChunk) => void
): DownloadSectionElement {
  const fragment = cloneTemplate('download-section', DOWNLOAD_SECTION_TEMPLATE);
  const element = fragment.firstElementChild as HTMLElement;
  
  const titleEl = element.querySelector('[data-title]') as HTMLElement;
  const countEl = element.querySelector('[data-count]') as HTMLElement;
  const downloadAllBtn = element.querySelector('[data-download-all]') as HTMLButtonElement;
  const downloadTextEl = element.querySelector('[data-download-text]') as HTMLElement;
  const chunkListEl = element.querySelector('[data-chunk-list]') as HTMLElement;
  
  titleEl.textContent = TRANSLATIONS.download.videoChunks;
  downloadTextEl.textContent = TRANSLATIONS.download.downloadZip;
  
  let currentChunks: VideoChunk[] = [];
  const chunkElements = new Map<string, HTMLElement>();
  
  const downloadAllCleanup = on(downloadAllBtn, 'click', () => {
    onDownloadAll();
  });
  
  const delegateCleanup = delegate(chunkListEl, 'click', '[data-download]', (e, target) => {
    const chunkItem = target.closest('[data-chunk-index]') as HTMLElement;
    if (chunkItem) {
      const index = parseInt(chunkItem.dataset.chunkIndex || '0', 10);
      const chunk = currentChunks[index];
      if (chunk) {
        onDownloadSingle(chunk);
      }
    }
  });
  
  const createChunkElement = (chunk: VideoChunk, index: number): HTMLElement => {
    const chunkFragment = cloneTemplate('chunk-item-' + index, CHUNK_ITEM_TEMPLATE);
    const chunkEl = chunkFragment.firstElementChild as HTMLElement;
    
    chunkEl.dataset.chunkIndex = String(index);
    
    const nameEl = chunkEl.querySelector('[data-name]') as HTMLElement;
    const timeEl = chunkEl.querySelector('[data-time]') as HTMLElement;
    const downloadBtn = chunkEl.querySelector('[data-download]') as HTMLButtonElement;
    
    nameEl.textContent = chunk.name;
    timeEl.textContent = formatTime(chunk.startTime) + ' – ' + formatTime(chunk.endTime);
    downloadBtn.setAttribute('aria-label', `${TRANSLATIONS.accessibility.downloadChunk}: ${chunk.name}`);
    
    return chunkEl;
  };
  
  const update = (chunks: VideoChunk[], isDownloading: boolean): void => {
    currentChunks = chunks;
    
    if (chunks.length === 0) {
      element.style.display = 'none';
      return;
    }
    
    element.style.display = '';
    countEl.textContent = TRANSLATIONS.download.chunkCount(chunks.length);
    downloadAllBtn.disabled = isDownloading;
    
    const existingKeys = new Set(chunkElements.keys());
    const newKeys = new Set<string>();
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const key = chunk.name + '-' + i;
      newKeys.add(key);
      
      if (!chunkElements.has(key)) {
        const chunkEl = createChunkElement(chunk, i);
        chunkElements.set(key, chunkEl);
        chunkListEl.appendChild(chunkEl);
      }
    }
    
    existingKeys.forEach(key => {
      if (!newKeys.has(key)) {
        const el = chunkElements.get(key);
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
        }
        chunkElements.delete(key);
      }
    });
  };
  
  const destroy = (): void => {
    downloadAllCleanup();
    delegateCleanup();
    chunkElements.clear();
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  };
  
  return { element, update, destroy };
}

export function mountDownloadSection(
  container: HTMLElement,
  chunksSignal: () => VideoChunk[],
  isDownloadingSignal: () => boolean,
  onDownloadAll: () => void,
  onDownloadSingle: (chunk: VideoChunk) => void
): () => void {
  const component = createDownloadSectionElement(onDownloadAll, onDownloadSingle);
  container.appendChild(component.element);
  
  const cleanup = createEffect(() => {
    const chunks = chunksSignal();
    const isDownloading = isDownloadingSignal();
    component.update(chunks, isDownloading);
  });
  
  return () => {
    cleanup();
    component.destroy();
  };
}
