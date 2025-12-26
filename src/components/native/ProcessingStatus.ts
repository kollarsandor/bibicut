import { createSignal, batch, createEffect } from '@/core/signal';
import { cloneTemplate, PROCESSING_STATUS_TEMPLATE, createIconSvg } from '@/core/templates';
import { on } from '@/core/dom';
import type { ProcessingStatus } from '@/types/video';
import { TRANSLATIONS } from '@/constants/translations';

export interface ProcessingStatusElement {
  element: HTMLElement;
  update: (status: ProcessingStatus, progress: number, currentStep: string, totalChunks: number, processedChunks: number) => void;
  destroy: () => void;
}

export function createProcessingStatusElement(): ProcessingStatusElement {
  const fragment = cloneTemplate('processing-status', PROCESSING_STATUS_TEMPLATE);
  const element = fragment.firstElementChild as HTMLElement;
  
  const iconContainer = element.querySelector('[data-icon-container]') as HTMLElement;
  const titleEl = element.querySelector('[data-title]') as HTMLElement;
  const stepEl = element.querySelector('[data-step]') as HTMLElement;
  const counterContainer = element.querySelector('[data-counter-container]') as HTMLElement;
  const counterEl = element.querySelector('[data-counter]') as HTMLElement;
  const counterLabelEl = element.querySelector('[data-counter-label]') as HTMLElement;
  const progressBar = element.querySelector('[data-progress-bar]') as HTMLElement;
  const percentEl = element.querySelector('[data-percent]') as HTMLElement;
  
  let currentStatus: ProcessingStatus = 'idle';
  
  const getStatusTitle = (status: ProcessingStatus): string => {
    switch (status) {
      case 'loading':
        return TRANSLATIONS.status.loading;
      case 'processing':
        return TRANSLATIONS.status.processing;
      case 'complete':
        return TRANSLATIONS.status.complete;
      case 'error':
        return TRANSLATIONS.status.error;
      default:
        return '';
    }
  };
  
  const getStatusIcon = (status: ProcessingStatus): string => {
    switch (status) {
      case 'loading':
        return createIconSvg('loader');
      case 'processing':
        return createIconSvg('scissors');
      case 'complete':
        return createIconSvg('check');
      case 'error':
        return createIconSvg('alert');
      default:
        return '';
    }
  };
  
  const update = (
    status: ProcessingStatus,
    progress: number,
    currentStep: string,
    totalChunks: number,
    processedChunks: number
  ): void => {
    if (status === 'idle') {
      element.style.display = 'none';
      return;
    }
    
    element.style.display = '';
    
    if (status !== currentStatus) {
      currentStatus = status;
      titleEl.textContent = getStatusTitle(status);
      iconContainer.innerHTML = getStatusIcon(status);
    }
    
    stepEl.textContent = currentStep;
    
    const progressPercent = Math.round(progress);
    progressBar.style.width = `${progress}%`;
    percentEl.textContent = `${progressPercent}%`;
    
    if (totalChunks > 0) {
      counterContainer.style.display = '';
      counterEl.textContent = `${processedChunks}/${totalChunks}`;
      counterLabelEl.textContent = TRANSLATIONS.status.chunk;
    } else {
      counterContainer.style.display = 'none';
    }
  };
  
  const destroy = (): void => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  };
  
  return { element, update, destroy };
}

export function mountProcessingStatus(
  container: HTMLElement,
  statusSignal: () => ProcessingStatus,
  progressSignal: () => number,
  stepSignal: () => string,
  totalChunksSignal: () => number,
  processedChunksSignal: () => number
): () => void {
  const component = createProcessingStatusElement();
  container.appendChild(component.element);
  
  const cleanup = createEffect(() => {
    const status = statusSignal();
    const progress = progressSignal();
    const step = stepSignal();
    const totalChunks = totalChunksSignal();
    const processedChunks = processedChunksSignal();
    
    component.update(status, progress, step, totalChunks, processedChunks);
  });
  
  return () => {
    cleanup();
    component.destroy();
  };
}
