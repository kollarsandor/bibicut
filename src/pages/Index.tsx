import { useState } from 'react';
import JSZip from 'jszip';
import { Scissors, RefreshCcw, Sparkles } from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { DownloadSection } from '@/components/DownloadSection';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface VideoChunk {
  name: string;
  startTime: number;
  endTime: number;
  blob: Blob;
}

const Index = () => {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const {
    status,
    progress,
    currentStep,
    chunks,
    totalChunks,
    processedChunks,
    processVideo,
    reset,
  } = useVideoProcessor();

  const handleFileSelect = async (file: File) => {
    toast({
      title: "Videó kiválasztva",
      description: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
    });
    await processVideo(file);
  };

  const handleYoutubeUrl = (url: string) => {
    toast({
      title: "YouTube támogatás",
      description: "A YouTube letöltés hamarosan elérhető lesz. Egyelőre kérlek töltsd le a videót, majd töltsd fel ide.",
      variant: "destructive",
    });
  };

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      
      chunks.forEach((chunk) => {
        zip.file(chunk.name, chunk.blob);
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'video_chunks.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Letöltés elkezdődött",
        description: `${chunks.length} videó részlet ZIP fájlban`,
      });
    } catch (error) {
      toast({
        title: "Hiba",
        description: "Nem sikerült létrehozni a ZIP fájlt",
        variant: "destructive",
      });
    }
    setIsDownloading(false);
  };

  const handleDownloadSingle = (chunk: VideoChunk) => {
    const url = URL.createObjectURL(chunk.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = chunk.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isProcessing = status === 'loading' || status === 'processing';

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-accent mb-6 glow-strong animate-float">
          <Scissors className="w-10 h-10 text-primary-foreground" />
        </div>
        
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4">
          Videó <span className="text-gradient">Daraboló</span>
        </h1>
        
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Tölts fel bármilyen videót, és automatikusan 1 perces részekre vágjuk.
          <br />
          <span className="inline-flex items-center gap-1 text-sm mt-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Teljesen a böngésződben fut, nem töltünk fel semmit
          </span>
        </p>
      </header>

      {/* Main Content */}
      <main className="space-y-8">
        {status === 'idle' && (
          <UploadZone
            onFileSelect={handleFileSelect}
            onYoutubeUrl={handleYoutubeUrl}
            isProcessing={isProcessing}
          />
        )}

        {(status === 'loading' || status === 'processing') && (
          <ProcessingStatus
            status={status}
            progress={progress}
            currentStep={currentStep}
            totalChunks={totalChunks}
            processedChunks={processedChunks}
          />
        )}

        {status === 'complete' && (
          <>
            <DownloadSection
              chunks={chunks}
              onDownloadAll={handleDownloadAll}
              onDownloadSingle={handleDownloadSingle}
              isDownloading={isDownloading}
            />
            
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={reset}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                Új videó feldolgozása
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="gradient-card rounded-2xl p-8 border border-destructive/50 max-w-md mx-auto">
              <p className="text-destructive mb-4">{currentStep}</p>
              <Button variant="outline" onClick={reset}>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Újrapróbálás
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 text-center text-sm text-muted-foreground">
        <p>Minden feldolgozás helyben, a böngésződben történik.</p>
        <p className="mt-1">A videóid nem kerülnek fel semmilyen szerverre.</p>
      </footer>
    </div>
  );
};

export default Index;
