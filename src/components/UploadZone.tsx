import { useCallback, useState } from 'react';
import { Upload, Film, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  onYoutubeUrl: (url: string) => void;
  isProcessing: boolean;
}

export const UploadZone = ({ onFileSelect, onYoutubeUrl, isProcessing }: UploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [mode, setMode] = useState<'upload' | 'youtube'>('upload');

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);

  const handleYoutubeSubmit = () => {
    if (youtubeUrl.trim()) {
      onYoutubeUrl(youtubeUrl.trim());
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6 justify-center">
        <Button
          variant={mode === 'upload' ? 'default' : 'outline'}
          onClick={() => setMode('upload')}
          disabled={isProcessing}
        >
          <Upload className="w-4 h-4 mr-2" />
          Fájl feltöltés
        </Button>
        <Button
          variant={mode === 'youtube' ? 'default' : 'outline'}
          onClick={() => setMode('youtube')}
          disabled={isProcessing}
        >
          <Link2 className="w-4 h-4 mr-2" />
          YouTube link
        </Button>
      </div>

      {mode === 'upload' ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer group",
            isDragging
              ? "border-primary bg-primary/10 glow-strong"
              : "border-border hover:border-primary/50 hover:bg-secondary/50",
            isProcessing && "opacity-50 pointer-events-none"
          )}
        >
          <input
            type="file"
            accept="video/*"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isProcessing}
          />
          
          <div className="flex flex-col items-center gap-4 text-center">
            <div className={cn(
              "w-20 h-20 rounded-2xl gradient-card flex items-center justify-center transition-all duration-300",
              isDragging ? "glow-strong scale-110" : "group-hover:glow-primary"
            )}>
              <Film className="w-10 h-10 text-primary" />
            </div>
            
            <div>
              <p className="text-lg font-medium text-foreground mb-1">
                Húzd ide a videót
              </p>
              <p className="text-sm text-muted-foreground">
                vagy kattints a tallózáshoz
              </p>
            </div>
            
            <p className="text-xs text-muted-foreground">
              MP4, MOV, AVI, WebM támogatott
            </p>
          </div>
        </div>
      ) : (
        <div className="gradient-card rounded-2xl p-8 border border-border">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="font-medium text-foreground">YouTube videó</p>
                <p className="text-sm text-muted-foreground">Illeszd be a videó linkjét</p>
              </div>
            </div>
            
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full h-12 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              disabled={isProcessing}
            />
            
            <Button
              variant="glow"
              size="lg"
              onClick={handleYoutubeSubmit}
              disabled={!youtubeUrl.trim() || isProcessing}
              className="w-full"
            >
              Videó feldolgozása
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
