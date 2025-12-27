import { createEffect } from '@/core/signal';
import { cloneTemplate, DOWNLOAD_SECTION_TEMPLATE, CHUNK_ITEM_TEMPLATE } from '@/core/templates';
import { on, delegate } from '@/core/dom';
import type { VideoChunk } from '@/types/video';
import { TRANSLATIONS } from '@/constants/translations';
import { formatTime } from '@/core/formatTime';
import { createVirtualList, VirtualListInstance } from '@/core/virtualList';

export interface DownloadSectionElement {
  element: HTMLElement;
  update: (chunks: VideoChunk[], isDownloading: boolean) => void;
  destroy: () => void;
}

const ITEM_HEIGHT = 76;
const VIRTUAL_THRESHOLD = 20;

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
  let virtualList: VirtualListInstance<VideoChunk> | null = null;
  let useVirtual = false;
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
    chunkEl.classList.add('gpu-layer');
    
    const nameEl = chunkEl.querySelector('[data-name]') as HTMLElement;
    const timeEl = chunkEl.querySelector('[data-time]') as HTMLElement;
    const downloadBtn = chunkEl.querySelector('[data-download]') as HTMLButtonElement;
    
    nameEl.textContent = chunk.name;
    timeEl.textContent = formatTime(chunk.startTime) + ' – ' + formatTime(chunk.endTime);
    downloadBtn.setAttribute('aria-label', `${TRANSLATIONS.accessibility.downloadChunk}: ${chunk.name}`);
    
    return chunkEl;
  };
  
  const renderNormalList = (chunks: VideoChunk[]): void => {
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
  
  const update = (chunks: VideoChunk[], isDownloading: boolean): void => {
    currentChunks = chunks;
    
    if (chunks.length === 0) {
      element.style.display = 'none';
      return;
    }
    
    element.style.display = '';
    countEl.textContent = TRANSLATIONS.download.chunkCount(chunks.length);
    downloadAllBtn.disabled = isDownloading;
    
    const shouldUseVirtual = chunks.length > VIRTUAL_THRESHOLD;
    
    if (shouldUseVirtual !== useVirtual) {
      useVirtual = shouldUseVirtual;
      if (virtualList) {
        virtualList.destroy();
        virtualList = null;
      }
      chunkElements.forEach(el => el.remove());
      chunkElements.clear();
    }
    
    if (useVirtual) {
      chunkListEl.className = 'max-h-80 pr-2 contain-strict';
      chunkListEl.style.height = Math.min(chunks.length * ITEM_HEIGHT, 320) + 'px';
      
      if (virtualList) {
        virtualList.update(chunks);
      } else {
        virtualList = createVirtualList({
          container: chunkListEl,
          items: chunks,
          itemHeight: ITEM_HEIGHT,
          renderItem: createChunkElement,
          keyFn: (chunk, index) => chunk.name + '-' + index,
          overscan: 5
        });
      }
    } else {
      chunkListEl.className = 'grid gap-3 max-h-80 overflow-y-auto pr-2 no-scrollbar';
      chunkListEl.style.height = '';
      renderNormalList(chunks);
    }
  };
  
  const destroy = (): void => {
    downloadAllCleanup();
    delegateCleanup();
    if (virtualList) {
      virtualList.destroy();
    }
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
