import { useEffect, useRef, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { createSignal, createEffect, batch } from '@/core/signal';
import { cloneTemplate } from '@/core/templates';
import { on } from '@/core/dom';
import { getVideoProcessorStore } from '@/stores/videoProcessor';
import { Toaster, toast, Button, ScissorsIcon, RefreshIcon, SparklesIcon } from '@/components/ui/ui';
import { createUploadZoneElement } from '@/components/native/UploadZone';
import { createProcessingStatusElement } from '@/components/native/ProcessingStatus';
import { createDownloadSectionElement } from '@/components/native/DownloadSection';
import type { VideoChunk, ProcessingStatus } from '@/types/video';
import { FILE_CONFIG } from '@/constants/config';
import { TRANSLATIONS } from '@/constants/translations';

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const Index = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uploadZoneRef = useRef<ReturnType<typeof createUploadZoneElement> | null>(null);
  const processingStatusRef = useRef<ReturnType<typeof createProcessingStatusElement> | null>(null);
  const downloadSectionRef = useRef<ReturnType<typeof createDownloadSectionElement> | null>(null);
  const storeRef = useRef(getVideoProcessorStore());
  const cleanupRef = useRef<(() => void)[]>([]);
  
  const [isDownloading, setIsDownloading] = createSignal(false);

  const handleFileSelect = useCallback(async (file: File) => {
    const fileSizeMb = file.size / FILE_CONFIG.BYTES_PER_MB;
    toast({
      title: TRANSLATIONS.index.videoSelected,
      description: `${file.name} (${fileSizeMb.toFixed(1)} MB)`,
    });
    await storeRef.current.actions.processVideo(file);
  }, []);

  const handleYoutubeUrl = useCallback(async (url: string) => {
    toast({
      title: TRANSLATIONS.index.youtubeProcessing,
      description: TRANSLATIONS.index.youtubeProcessingDesc,
    });
    await storeRef.current.actions.processYoutubeUrl(url);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    setIsDownloading(true);
    try {
      const chunks = storeRef.current.getChunks();
      const zip = new JSZip();
      const chunksLen = chunks.length;

      for (let i = 0; i < chunksLen; i++) {
        zip.file(chunks[i].name, chunks[i].blob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, FILE_CONFIG.ZIP_FILENAME);

      toast({
        title: TRANSLATIONS.download.downloadStarted,
        description: TRANSLATIONS.download.downloadDescription(chunksLen),
      });
    } catch (error) {
      console.error('ZIP creation error:', error);
      toast({
        title: TRANSLATIONS.download.error,
        description: TRANSLATIONS.download.zipError,
        variant: 'destructive',
      });
    }
    setIsDownloading(false);
  }, []);

  const handleDownloadSingle = useCallback((chunk: VideoChunk) => {
    downloadBlob(chunk.blob, chunk.name);
  }, []);

  const handleReset = useCallback(() => {
    storeRef.current.actions.reset();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const store = storeRef.current;
    const mainContent = container.querySelector('[data-main-content]') as HTMLElement;
    if (!mainContent) return;
    
    const uploadContainer = document.createElement('div');
    uploadContainer.dataset.uploadZone = '';
    
    const processingContainer = document.createElement('div');
    processingContainer.dataset.processingStatus = '';
    
    const downloadContainer = document.createElement('div');
    downloadContainer.dataset.downloadSection = '';
    
    mainContent.appendChild(uploadContainer);
    mainContent.appendChild(processingContainer);
    mainContent.appendChild(downloadContainer);
    
    const uploadZone = createUploadZoneElement(handleFileSelect, handleYoutubeUrl);
    uploadZoneRef.current = uploadZone;
    uploadContainer.appendChild(uploadZone.element);
    
    const processingStatus = createProcessingStatusElement();
    processingStatusRef.current = processingStatus;
    processingContainer.appendChild(processingStatus.element);
    processingStatus.update('idle', 0, '', 0, 0);
    
    const downloadSection = createDownloadSectionElement(handleDownloadAll, handleDownloadSingle);
    downloadSectionRef.current = downloadSection;
    downloadContainer.appendChild(downloadSection.element);
    downloadSection.update([], false);
    
    const errorContainer = container.querySelector('[data-error-container]') as HTMLElement;
    const completeActions = container.querySelector('[data-complete-actions]') as HTMLElement;
    
    const updateUI = (): void => {
      const status = store.getStatus();
      const progress = store.getProgress();
      const currentStep = store.getCurrentStep();
      const chunks = store.getChunks();
      const totalChunks = store.getTotalChunks();
      const processedChunks = store.getProcessedChunks();
      const downloading = isDownloading();
      
      const isProcessing = status === 'loading' || status === 'processing';
      
      if (status === 'idle') {
        uploadZone.element.style.display = '';
        uploadZone.setProcessing(false);
      } else {
        uploadZone.element.style.display = 'none';
      }
      
      if (status === 'loading' || status === 'processing') {
        processingStatus.update(status, progress, currentStep, totalChunks, processedChunks);
      } else {
        processingStatus.update('idle', 0, '', 0, 0);
      }
      
      if (status === 'complete') {
        downloadSection.update(chunks, downloading);
        if (completeActions) {
          completeActions.style.display = '';
        }
      } else {
        downloadSection.update([], false);
        if (completeActions) {
          completeActions.style.display = 'none';
        }
      }
      
      if (errorContainer) {
        if (status === 'error') {
          errorContainer.style.display = '';
          const errorText = errorContainer.querySelector('[data-error-text]');
          if (errorText) {
            errorText.textContent = currentStep;
          }
        } else {
          errorContainer.style.display = 'none';
        }
      }
    };
    
    const unsubscribe = store.subscribe(updateUI);
    cleanupRef.current.push(unsubscribe);
    
    const downloadingCleanup = createEffect(() => {
      isDownloading();
      updateUI();
    });
    cleanupRef.current.push(downloadingCleanup);
    
    updateUI();
    
    return () => {
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current = [];
      uploadZone.destroy();
      processingStatus.destroy();
      downloadSection.destroy();
    };
  }, [handleFileSelect, handleYoutubeUrl, handleDownloadAll, handleDownloadSingle]);

  const titleParts = useMemo(() => {
    const parts = TRANSLATIONS.index.title.split(' ');
    return { first: parts[0], second: parts[1] };
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen py-16 px-6 sm:px-8 lg:px-12">
      <header className="text-center mb-16 animate-fade-in">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl gradient-accent mb-8 apple-shadow glow-strong animate-float">
          <ScissorsIcon className="w-12 h-12 text-primary-foreground" aria-hidden="true" />
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 tracking-tight">
          {titleParts.first}{' '}
          <span className="text-gradient">{titleParts.second}</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
          {TRANSLATIONS.index.subtitle}
        </p>
        
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-secondary/50 glass-border">
          <SparklesIcon className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">{TRANSLATIONS.index.youtubeSupport}</span>
        </div>
      </header>

      <main className="space-y-10" data-main-content>
      </main>

      <div 
        data-error-container 
        className="text-center animate-fade-in" 
        style={{ display: 'none' }}
      >
        <div className="glass glass-border apple-shadow rounded-3xl p-10 max-w-md mx-auto" role="alert">
          <p className="text-destructive mb-6 text-lg" data-error-text></p>
          <Button variant="outline" size="lg" onClick={handleReset} className="apple-hover">
            <RefreshIcon className="w-4 h-4 mr-2" aria-hidden="true" />
            {TRANSLATIONS.index.retry}
          </Button>
        </div>
      </div>

      <div 
        data-complete-actions 
        className="flex justify-center mt-10" 
        style={{ display: 'none' }}
      >
        <Button variant="outline" size="lg" onClick={handleReset} className="apple-hover">
          <RefreshIcon className="w-4 h-4 mr-2" aria-hidden="true" />
          {TRANSLATIONS.index.newVideo}
        </Button>
      </div>

      <footer className="mt-20 text-center">
        <p className="text-sm text-muted-foreground/60">{TRANSLATIONS.index.footerLine1}</p>
        <p className="text-sm text-muted-foreground/40 mt-1">{TRANSLATIONS.index.footerLine2}</p>
      </footer>
    </div>
  );
};

export default Index;
