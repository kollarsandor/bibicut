import { createSignal, createEffect, batch } from '@/core/signal';
import { cloneTemplate, UPLOAD_ZONE_TEMPLATE, UPLOAD_DROP_ZONE_TEMPLATE, YOUTUBE_INPUT_TEMPLATE } from '@/core/templates';
import { on } from '@/core/dom';
import { FILE_CONFIG } from '@/constants/config';
import { TRANSLATIONS } from '@/constants/translations';

export interface UploadZoneElement {
  element: HTMLElement;
  setProcessing: (processing: boolean) => void;
  destroy: () => void;
}

const YOUTUBE_URL_PATTERN = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]{11}/;

const validateYoutubeUrl = (url: string): boolean => {
  return YOUTUBE_URL_PATTERN.test(url.trim());
};

const validateVideoFile = (file: File): { valid: boolean; error?: string } => {
  const supportedFormats = FILE_CONFIG.SUPPORTED_FORMATS;
  const fileType = file.type;
  
  let isSupported = false;
  for (let i = 0; i < supportedFormats.length; i++) {
    if (supportedFormats[i] === fileType) {
      isSupported = true;
      break;
    }
  }
  
  if (!isSupported && !fileType.startsWith('video/')) {
    return { valid: false, error: TRANSLATIONS.upload.invalidFormat };
  }

  const fileSizeMb = file.size / FILE_CONFIG.BYTES_PER_MB;
  if (fileSizeMb > FILE_CONFIG.MAX_FILE_SIZE_MB) {
    return { valid: false, error: TRANSLATIONS.upload.fileSizeError(FILE_CONFIG.MAX_FILE_SIZE_MB) };
  }

  return { valid: true };
};

export function createUploadZoneElement(
  onFileSelect: (file: File) => void,
  onYoutubeUrl: (url: string) => void
): UploadZoneElement {
  const fragment = cloneTemplate('upload-zone', UPLOAD_ZONE_TEMPLATE);
  const element = fragment.firstElementChild as HTMLElement;
  
  const tabsContainer = element.querySelector('[data-tabs]') as HTMLElement;
  const errorEl = element.querySelector('[data-error]') as HTMLElement;
  const uploadArea = element.querySelector('[data-upload-area]') as HTMLElement;
  
  let mode: 'upload' | 'youtube' = 'upload';
  let isProcessing = false;
  let youtubeUrl = '';
  
  const cleanups: (() => void)[] = [];
  
  const createTabButton = (label: string, icon: string, isActive: boolean, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.className = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97] h-12 rounded-xl px-8 text-base apple-hover ${isActive ? 'bg-primary text-primary-foreground hover:bg-primary/90 apple-shadow-sm' : 'glass glass-border text-foreground hover:bg-secondary/30'}`;
    btn.innerHTML = icon + '<span>' + label + '</span>';
    btn.addEventListener('click', onClick);
    return btn;
  };
  
  const uploadIcon = `<svg class="w-4 h-4 mr-2" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 8L12 3L7 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 3V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  
  const linkIcon = `<svg class="w-4 h-4 mr-2" width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M10 13C10.4295 13.5741 10.9774 14.0492 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59699 21.9548 8.33397 21.9434 7.02299C21.932 5.71201 21.4061 4.45794 20.4791 3.5309C19.5521 2.60386 18.298 2.07802 16.987 2.06663C15.676 2.05523 14.413 2.55921 13.47 3.47L11.75 5.18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11C13.5705 10.4259 13.0226 9.95083 12.3934 9.60707C11.7642 9.26331 11.0685 9.05889 10.3533 9.00768C9.63816 8.95646 8.92037 9.05964 8.24861 9.31023C7.57685 9.56082 6.96687 9.953 6.46 10.46L3.46 13.46C2.54921 14.403 2.04524 15.666 2.05663 16.977C2.06802 18.288 2.59387 19.5421 3.52091 20.4691C4.44795 21.3961 5.70201 21.922 7.013 21.9334C8.32398 21.9448 9.58699 21.4408 10.53 20.53L12.24 18.82" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  
  const showError = (message: string | null): void => {
    if (message) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    } else {
      errorEl.classList.add('hidden');
    }
  };
  
  const renderUploadMode = (): void => {
    uploadArea.innerHTML = '';
    const dropFragment = cloneTemplate('upload-dropzone', UPLOAD_DROP_ZONE_TEMPLATE);
    const dropZone = dropFragment.firstElementChild as HTMLElement;
    
    const titleEl = dropZone.querySelector('[data-title]') as HTMLElement;
    const subtitleEl = dropZone.querySelector('[data-subtitle]') as HTMLElement;
    const formatsEl = dropZone.querySelector('[data-formats]') as HTMLElement;
    const fileInput = dropZone.querySelector('[data-file-input]') as HTMLInputElement;
    const dropzoneEl = dropZone.querySelector('[data-dropzone]') || dropZone;
    
    titleEl.textContent = TRANSLATIONS.upload.dragHere;
    subtitleEl.textContent = TRANSLATIONS.upload.orClickToBrowse;
    formatsEl.textContent = TRANSLATIONS.upload.supportedFormats;
    
    if (isProcessing) {
      fileInput.disabled = true;
      dropZone.classList.add('opacity-50', 'pointer-events-none');
    }
    
    const handleDragOver = (e: DragEvent): void => {
      e.preventDefault();
      dropZone.classList.add('border-primary', 'bg-primary/5', 'glow-strong');
      dropZone.classList.remove('border-border');
    };
    
    const handleDragLeave = (e: DragEvent): void => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-primary/5', 'glow-strong');
      dropZone.classList.add('border-border');
    };
    
    const handleDrop = (e: DragEvent): void => {
      e.preventDefault();
      dropZone.classList.remove('border-primary', 'bg-primary/5', 'glow-strong');
      dropZone.classList.add('border-border');
      showError(null);
      
      const file = e.dataTransfer?.files[0];
      if (file) {
        const validation = validateVideoFile(file);
        if (validation.valid) {
          onFileSelect(file);
        } else {
          showError(validation.error || null);
        }
      }
    };
    
    const handleFileInput = (e: Event): void => {
      showError(null);
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) {
        const validation = validateVideoFile(file);
        if (validation.valid) {
          onFileSelect(file);
        } else {
          showError(validation.error || null);
        }
      }
    };
    
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileInput);
    
    cleanups.push(() => {
      dropZone.removeEventListener('dragover', handleDragOver);
      dropZone.removeEventListener('dragleave', handleDragLeave);
      dropZone.removeEventListener('drop', handleDrop);
      fileInput.removeEventListener('change', handleFileInput);
    });
    
    uploadArea.appendChild(dropZone);
  };
  
  const renderYoutubeMode = (): void => {
    uploadArea.innerHTML = '';
    const ytFragment = cloneTemplate('youtube-input', YOUTUBE_INPUT_TEMPLATE);
    const ytEl = ytFragment.firstElementChild as HTMLElement;
    
    const titleEl = ytEl.querySelector('[data-title]') as HTMLElement;
    const subtitleEl = ytEl.querySelector('[data-subtitle]') as HTMLElement;
    const urlInput = ytEl.querySelector('[data-url-input]') as HTMLInputElement;
    const submitBtn = ytEl.querySelector('[data-submit]') as HTMLButtonElement;
    const submitTextEl = ytEl.querySelector('[data-submit-text]') as HTMLElement;
    
    titleEl.textContent = TRANSLATIONS.upload.youtubeVideo;
    subtitleEl.textContent = TRANSLATIONS.upload.pasteLink;
    submitTextEl.textContent = TRANSLATIONS.upload.processVideo;
    
    if (isProcessing) {
      urlInput.disabled = true;
      submitBtn.disabled = true;
    }
    
    urlInput.value = youtubeUrl;
    
    const updateSubmitState = (): void => {
      const trimmedUrl = urlInput.value.trim();
      const isValid = validateYoutubeUrl(trimmedUrl);
      submitBtn.disabled = !trimmedUrl || isProcessing || !isValid;
    };
    
    updateSubmitState();
    
    const handleInput = (): void => {
      youtubeUrl = urlInput.value;
      showError(null);
      updateSubmitState();
    };
    
    const handleSubmit = (): void => {
      showError(null);
      const trimmedUrl = urlInput.value.trim();
      
      if (!validateYoutubeUrl(trimmedUrl)) {
        showError(TRANSLATIONS.upload.invalidYoutubeUrl);
        return;
      }
      
      onYoutubeUrl(trimmedUrl);
    };
    
    urlInput.addEventListener('input', handleInput);
    submitBtn.addEventListener('click', handleSubmit);
    
    cleanups.push(() => {
      urlInput.removeEventListener('input', handleInput);
      submitBtn.removeEventListener('click', handleSubmit);
    });
    
    uploadArea.appendChild(ytEl);
  };
  
  const renderTabs = (): void => {
    tabsContainer.innerHTML = '';
    
    const uploadBtn = createTabButton(TRANSLATIONS.upload.fileUpload, uploadIcon, mode === 'upload', () => {
      if (mode !== 'upload') {
        mode = 'upload';
        showError(null);
        renderTabs();
        renderCurrentMode();
      }
    });
    
    const ytBtn = createTabButton(TRANSLATIONS.upload.youtubeLink, linkIcon, mode === 'youtube', () => {
      if (mode !== 'youtube') {
        mode = 'youtube';
        showError(null);
        renderTabs();
        renderCurrentMode();
      }
    });
    
    if (isProcessing) {
      uploadBtn.disabled = true;
      ytBtn.disabled = true;
    }
    
    tabsContainer.appendChild(uploadBtn);
    tabsContainer.appendChild(ytBtn);
  };
  
  const renderCurrentMode = (): void => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) fn();
    }
    
    if (mode === 'upload') {
      renderUploadMode();
    } else {
      renderYoutubeMode();
    }
  };
  
  renderTabs();
  renderCurrentMode();
  
  const setProcessing = (processing: boolean): void => {
    isProcessing = processing;
    renderTabs();
    renderCurrentMode();
  };
  
  const destroy = (): void => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) fn();
    }
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  };
  
  return { element, setProcessing, destroy };
}

export function mountUploadZone(
  container: HTMLElement,
  isProcessingSignal: () => boolean,
  onFileSelect: (file: File) => void,
  onYoutubeUrl: (url: string) => void
): () => void {
  const component = createUploadZoneElement(onFileSelect, onYoutubeUrl);
  container.appendChild(component.element);
  
  const cleanup = createEffect(() => {
    const processing = isProcessingSignal();
    component.setProcessing(processing);
  });
  
  return () => {
    cleanup();
    component.destroy();
  };
}
