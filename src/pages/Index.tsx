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
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <header className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-accent mb-6 glow-strong animate-float">
          <Scissors className="w-10 h-10 text-primary-foreground" aria-hidden="true" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
          {TRANSLATIONS.index.title.split(' ')[0]} <span className="text-gradient">{TRANSLATIONS.index.title.split(' ')[1]}</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          {TRANSLATIONS.index.subtitle}
          <br />
          <span className="inline-flex items-center gap-1 text-sm mt-2">
            <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
            {TRANSLATIONS.index.youtubeSupport}
          </span>
        </p>
      </header>

      <main className="space-y-8">
        {status === 'idle' && <UploadZone onFileSelect={handleFileSelect} onYoutubeUrl={handleYoutubeUrl} isProcessing={isProcessing} />}

        {(status === 'loading' || status === 'processing') && <ProcessingStatus status={status} progress={progress} currentStep={currentStep} totalChunks={totalChunks} processedChunks={processedChunks} />}

        {status === 'complete' && (
          <>
            <DownloadSection chunks={chunks} onDownloadAll={handleDownloadAll} onDownloadSingle={handleDownloadSingle} isDownloading={isDownloading} />

            <div className="flex justify-center">
              <Button variant="outline" size="lg" onClick={reset}>
                <RefreshCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                {TRANSLATIONS.index.newVideo}
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="gradient-card rounded-2xl p-8 border border-destructive/50 max-w-md mx-auto" role="alert">
              <p className="text-destructive mb-4">{currentStep}</p>
              <Button variant="outline" onClick={reset}>
                <RefreshCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                {TRANSLATIONS.index.retry}
              </Button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-16 text-center text-sm text-muted-foreground">
        <p>{TRANSLATIONS.index.footerLine1}</p>
        <p className="mt-1">{TRANSLATIONS.index.footerLine2}</p>
      </footer>
    </div>
  );
};

export default Index;