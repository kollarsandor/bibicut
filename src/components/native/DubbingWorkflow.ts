import type { DubbedChunk, DubbingStatus } from '@/stores/dubbingWorkflow';

export interface DubbingWorkflowElement {
  element: HTMLElement;
  update: (
    status: DubbingStatus,
    progress: number,
    currentStep: string,
    dubbedChunks: DubbedChunk[],
    totalChunks: number,
    completedChunks: number,
    hasFinalVideo: boolean,
    hasMergedAudio: boolean
  ) => void;
  destroy: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function createDubbingWorkflowElement(
  onUploadChunk: (index: number, file: File) => void,
  onUploadAll: (files: FileList) => void,
  onMerge: () => void,
  onDownloadVideo: () => void,
  onDownloadAudio: () => void,
  onReset: () => void
): DubbingWorkflowElement {
  const container = document.createElement('div');
  container.className = 'space-y-6';
  
  const headerSection = document.createElement('div');
  headerSection.className = 'glass glass-border apple-shadow rounded-3xl p-8';
  
  const headerTitle = document.createElement('h2');
  headerTitle.className = 'text-2xl font-bold text-foreground mb-2';
  headerTitle.textContent = 'Magyar Szinkron Készítő';
  
  const headerDesc = document.createElement('p');
  headerDesc.className = 'text-muted-foreground';
  headerDesc.textContent = 'Töltsd fel a subformer.com-on ledubbolt videókat a megfelelő sorrendben.';
  
  const statusText = document.createElement('p');
  statusText.className = 'text-primary font-medium mt-4';
  statusText.dataset.status = '';
  
  const progressContainer = document.createElement('div');
  progressContainer.className = 'mt-4';
  progressContainer.dataset.progressContainer = '';
  
  const progressBar = document.createElement('div');
  progressBar.className = 'h-2 bg-secondary rounded-full overflow-hidden';
  
  const progressFill = document.createElement('div');
  progressFill.className = 'h-full bg-primary transition-all duration-300';
  progressFill.style.width = '0%';
  progressFill.dataset.progressFill = '';
  
  progressBar.appendChild(progressFill);
  progressContainer.appendChild(progressBar);
  
  headerSection.appendChild(headerTitle);
  headerSection.appendChild(headerDesc);
  headerSection.appendChild(statusText);
  headerSection.appendChild(progressContainer);
  
  const uploadSection = document.createElement('div');
  uploadSection.className = 'glass glass-border apple-shadow rounded-3xl p-8';
  uploadSection.dataset.uploadSection = '';
  
  const uploadTitle = document.createElement('h3');
  uploadTitle.className = 'text-xl font-semibold text-foreground mb-4';
  uploadTitle.textContent = 'Dubbolt Videók Feltöltése';
  
  const bulkUploadContainer = document.createElement('div');
  bulkUploadContainer.className = 'mb-6 p-4 bg-secondary/30 rounded-2xl border border-border/50';
  
  const bulkUploadLabel = document.createElement('label');
  bulkUploadLabel.className = 'block text-sm font-medium text-foreground mb-2';
  bulkUploadLabel.textContent = 'Összes dubbolt videó feltöltése egyszerre:';
  
  const bulkUploadInput = document.createElement('input');
  bulkUploadInput.type = 'file';
  bulkUploadInput.accept = 'video/*';
  bulkUploadInput.multiple = true;
  bulkUploadInput.className = 'block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer';
  bulkUploadInput.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      onUploadAll(target.files);
    }
  });
  
  bulkUploadContainer.appendChild(bulkUploadLabel);
  bulkUploadContainer.appendChild(bulkUploadInput);
  
  const chunksGrid = document.createElement('div');
  chunksGrid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4';
  chunksGrid.dataset.chunksGrid = '';
  
  uploadSection.appendChild(uploadTitle);
  uploadSection.appendChild(bulkUploadContainer);
  uploadSection.appendChild(chunksGrid);
  
  const actionsSection = document.createElement('div');
  actionsSection.className = 'flex flex-wrap gap-4 justify-center';
  actionsSection.dataset.actionsSection = '';
  
  const mergeButton = document.createElement('button');
  mergeButton.className = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-primary-foreground bg-primary hover:bg-primary/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed apple-hover';
  mergeButton.dataset.mergeButton = '';
  mergeButton.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
    </svg>
    <span>Hangok Összefűzése és Csere</span>
  `;
  mergeButton.addEventListener('click', onMerge);
  
  const downloadVideoButton = document.createElement('button');
  downloadVideoButton.className = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-foreground bg-secondary hover:bg-secondary/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed apple-hover';
  downloadVideoButton.dataset.downloadVideoButton = '';
  downloadVideoButton.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
    </svg>
    <span>Videó Letöltése</span>
  `;
  downloadVideoButton.addEventListener('click', onDownloadVideo);
  
  const downloadAudioButton = document.createElement('button');
  downloadAudioButton.className = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-foreground bg-secondary hover:bg-secondary/80 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed apple-hover';
  downloadAudioButton.dataset.downloadAudioButton = '';
  downloadAudioButton.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
    </svg>
    <span>MP3 Letöltése</span>
  `;
  downloadAudioButton.addEventListener('click', onDownloadAudio);
  
  const resetButton = document.createElement('button');
  resetButton.className = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-foreground bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all duration-300 apple-hover';
  resetButton.dataset.resetButton = '';
  resetButton.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
    </svg>
    <span>Újrakezdés</span>
  `;
  resetButton.addEventListener('click', onReset);
  
  actionsSection.appendChild(mergeButton);
  actionsSection.appendChild(downloadVideoButton);
  actionsSection.appendChild(downloadAudioButton);
  actionsSection.appendChild(resetButton);
  
  container.appendChild(headerSection);
  container.appendChild(uploadSection);
  container.appendChild(actionsSection);
  
  const chunkInputListeners: Map<number, (e: Event) => void> = new Map();
  
  const update = (
    status: DubbingStatus,
    progress: number,
    currentStep: string,
    dubbedChunks: DubbedChunk[],
    totalChunks: number,
    completedChunks: number,
    hasFinalVideo: boolean,
    hasMergedAudio: boolean
  ): void => {
    if (status === 'idle') {
      container.style.display = 'none';
      return;
    }
    
    container.style.display = '';
    
    statusText.textContent = currentStep;
    progressFill.style.width = `${progress}%`;
    
    const isProcessing = status === 'merging' || status === 'replacing';
    const isComplete = status === 'complete';
    const isAwaiting = status === 'awaiting_dubbed';
    
    if (isProcessing || isComplete) {
      uploadSection.style.display = 'none';
    } else {
      uploadSection.style.display = '';
    }
    
    chunksGrid.innerHTML = '';
    chunkInputListeners.clear();
    
    for (let i = 0; i < dubbedChunks.length; i++) {
      const chunk = dubbedChunks[i];
      const chunkCard = document.createElement('div');
      chunkCard.className = `p-4 rounded-xl border transition-all duration-300 ${
        chunk.status === 'uploaded' || chunk.status === 'complete' 
          ? 'bg-success/10 border-success/30' 
          : 'bg-secondary/30 border-border/50'
      }`;
      
      const chunkHeader = document.createElement('div');
      chunkHeader.className = 'flex items-center justify-between mb-2';
      
      const chunkTitle = document.createElement('span');
      chunkTitle.className = 'font-medium text-foreground';
      chunkTitle.textContent = `Részlet ${i + 1}`;
      
      const chunkTime = document.createElement('span');
      chunkTime.className = 'text-sm text-muted-foreground';
      chunkTime.textContent = `${formatTime(chunk.originalChunk.startTime)} - ${formatTime(chunk.originalChunk.endTime)}`;
      
      chunkHeader.appendChild(chunkTitle);
      chunkHeader.appendChild(chunkTime);
      
      const chunkStatus = document.createElement('div');
      chunkStatus.className = 'text-sm mb-2';
      
      if (chunk.status === 'uploaded' || chunk.status === 'complete') {
        chunkStatus.className += ' text-success';
        chunkStatus.innerHTML = `
          <span class="inline-flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            Feltöltve
          </span>
        `;
      } else {
        chunkStatus.className += ' text-warning';
        chunkStatus.textContent = 'Várakozás feltöltésre...';
      }
      
      const chunkInput = document.createElement('input');
      chunkInput.type = 'file';
      chunkInput.accept = 'video/*';
      chunkInput.className = 'block w-full text-xs text-muted-foreground file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-medium file:bg-primary/80 file:text-primary-foreground hover:file:bg-primary cursor-pointer';
      
      const listener = (e: Event): void => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files[0]) {
          onUploadChunk(i, target.files[0]);
        }
      };
      chunkInput.addEventListener('change', listener);
      chunkInputListeners.set(i, listener);
      
      chunkCard.appendChild(chunkHeader);
      chunkCard.appendChild(chunkStatus);
      chunkCard.appendChild(chunkInput);
      
      chunksGrid.appendChild(chunkCard);
    }
    
    const allUploaded = completedChunks === totalChunks && totalChunks > 0;
    
    mergeButton.disabled = !allUploaded || isProcessing || isComplete;
    mergeButton.style.display = isComplete ? 'none' : '';
    
    downloadVideoButton.disabled = !hasFinalVideo;
    downloadVideoButton.style.display = isComplete ? '' : 'none';
    
    downloadAudioButton.disabled = !hasMergedAudio;
    downloadAudioButton.style.display = isComplete ? '' : 'none';
  };
  
  const destroy = (): void => {
    chunkInputListeners.clear();
    container.remove();
  };
  
  return { element: container, update, destroy };
}
