import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { Scissors, RefreshCcw, Sparkles } from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { DownloadSection } from '@/components/DownloadSection';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { VideoChunk } from '@/types/video';
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
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const { status, progress, currentStep, chunks, totalChunks, processedChunks, processVideo, processYoutubeUrl, reset } = useVideoProcessor();

  const handleFileSelect = useCallback(
    async (file: File) => {
      const fileSizeMb = file.size / FILE_CONFIG.BYTES_PER_MB;
      toast({
        title: TRANSLATIONS.index.videoSelected,
        description: `${file.name} (${fileSizeMb.toFixed(1)} MB)`,
      });
      await processVideo(file);
    },
    [toast, processVideo]
  );

  const handleYoutubeUrl = useCallback(
    async (url: string) => {
      toast({
        title: TRANSLATIONS.index.youtubeProcessing,
        description: TRANSLATIONS.index.youtubeProcessingDesc,
      });
      await processYoutubeUrl(url);
    },
    [toast, processYoutubeUrl]
  );

  const handleDownloadAll = useCallback(async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();

      chunks.forEach((chunk) => {
        zip.file(chunk.name, chunk.blob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      downloadBlob(content, FILE_CONFIG.ZIP_FILENAME);

      toast({
        title: TRANSLATIONS.download.downloadStarted,
        description: TRANSLATIONS.download.downloadDescription(chunks.length),
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
  }, [chunks, toast]);

  const handleDownloadSingle = useCallback((chunk: VideoChunk) => {
    downloadBlob(chunk.blob, chunk.name);
  }, []);

  const isProcessing = status === 'loading' || status === 'processing';

  return (
    <div className="min-h-screen py-16 px-6 sm:px-8 lg:px-12">
      <header className="text-center mb-16 animate-fade-in">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl gradient-accent mb-8 apple-shadow glow-strong animate-float">
          <Scissors className="w-12 h-12 text-primary-foreground" aria-hidden="true" />
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-foreground mb-6 tracking-tight">
          {TRANSLATIONS.index.title.split(' ')[0]}{' '}
          <span className="text-gradient">{TRANSLATIONS.index.title.split(' ')[1]}</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
          {TRANSLATIONS.index.subtitle}
        </p>
        
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full bg-secondary/50 glass-border">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">{TRANSLATIONS.index.youtubeSupport}</span>
        </div>
      </header>

      <main className="space-y-10">
        {status === 'idle' && <UploadZone onFileSelect={handleFileSelect} onYoutubeUrl={handleYoutubeUrl} isProcessing={isProcessing} />}

        {(status === 'loading' || status === 'processing') && <ProcessingStatus status={status} progress={progress} currentStep={currentStep} totalChunks={totalChunks} processedChunks={processedChunks} />}

        {status === 'complete' && (
          <>
            <DownloadSection chunks={chunks} onDownloadAll={handleDownloadAll} onDownloadSingle={handleDownloadSingle} isDownloading={isDownloading} />

            <div className="flex justify-center">
              <Button variant="outline" size="lg" onClick={reset} className="apple-hover">
                <RefreshCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                {TRANSLATIONS.index.newVideo}
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <div className="text-center animate-fade-in">
            <div className="glass glass-border apple-shadow rounded-3xl p-10 max-w-md mx-auto" role="alert">
              <p className="text-destructive mb-6 text-lg">{currentStep}</p>
              <Button variant="outline" size="lg" onClick={reset} className="apple-hover">
                <RefreshCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                {TRANSLATIONS.index.retry}
              </Button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-20 text-center">
        <p className="text-sm text-muted-foreground/60">{TRANSLATIONS.index.footerLine1}</p>
        <p className="text-sm text-muted-foreground/40 mt-1">{TRANSLATIONS.index.footerLine2}</p>
      </footer>
    </div>
  );
};

export default Index;