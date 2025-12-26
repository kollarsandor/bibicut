import { useCallback, useState, useMemo } from 'react';
import { Upload, Film, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FILE_CONFIG } from '@/constants/config';
import { TRANSLATIONS } from '@/constants/translations';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  onYoutubeUrl: (url: string) => void;
  isProcessing: boolean;
}

const YOUTUBE_URL_PATTERN = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)[a-zA-Z0-9_-]{11}/;

const validateYoutubeUrl = (url: string): boolean => {
  return YOUTUBE_URL_PATTERN.test(url.trim());
};

const validateVideoFile = (file: File): { valid: boolean; error?: string } => {
  const supportedFormats: string[] = [...FILE_CONFIG.SUPPORTED_FORMATS];
  if (!supportedFormats.includes(file.type) && !file.type.startsWith('video/')) {
    return { valid: false, error: TRANSLATIONS.upload.invalidFormat };
  }

  const fileSizeMb = file.size / FILE_CONFIG.BYTES_PER_MB;
  if (fileSizeMb > FILE_CONFIG.MAX_FILE_SIZE_MB) {
    return { valid: false, error: TRANSLATIONS.upload.fileSizeError(FILE_CONFIG.MAX_FILE_SIZE_MB) };
  }

  return { valid: true };
};

export const UploadZone = ({ onFileSelect, onYoutubeUrl, isProcessing }: UploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [mode, setMode] = useState<'upload' | 'youtube'>('upload');
  const [error, setError] = useState<string | null>(null);

  const isValidYoutubeUrl = useMemo(() => validateYoutubeUrl(youtubeUrl), [youtubeUrl]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setError(null);

      const file = e.dataTransfer.files[0];
      if (file) {
        const validation = validateVideoFile(file);
        if (validation.valid) {
          onFileSelect(file);
        } else {
          setError(validation.error || null);
        }
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (file) {
        const validation = validateVideoFile(file);
        if (validation.valid) {
          onFileSelect(file);
        } else {
          setError(validation.error || null);
        }
      }
    },
    [onFileSelect]
  );

  const handleYoutubeSubmit = useCallback(() => {
    setError(null);
    const trimmedUrl = youtubeUrl.trim();

    if (!validateYoutubeUrl(trimmedUrl)) {
      setError(TRANSLATIONS.upload.invalidYoutubeUrl);
      return;
    }

    onYoutubeUrl(trimmedUrl);
  }, [youtubeUrl, onYoutubeUrl]);

  const handleModeChange = useCallback((newMode: 'upload' | 'youtube') => {
    setMode(newMode);
    setError(null);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div className="flex gap-3 mb-8 justify-center" role="tablist" aria-label="Feltöltési mód">
        <Button 
          variant={mode === 'upload' ? 'default' : 'glass'} 
          size="lg"
          onClick={() => handleModeChange('upload')} 
          disabled={isProcessing} 
          role="tab" 
          aria-selected={mode === 'upload'} 
          aria-controls="upload-panel"
          className="apple-hover"
        >
          <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
          {TRANSLATIONS.upload.fileUpload}
        </Button>
        <Button 
          variant={mode === 'youtube' ? 'default' : 'glass'} 
          size="lg"
          onClick={() => handleModeChange('youtube')} 
          disabled={isProcessing} 
          role="tab" 
          aria-selected={mode === 'youtube'} 
          aria-controls="youtube-panel"
          className="apple-hover"
        >
          <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
          {TRANSLATIONS.upload.youtubeLink}
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center animate-fade-in" role="alert">
          {error}
        </div>
      )}

      {mode === 'upload' ? (
        <div
          id="upload-panel"
          role="tabpanel"
          aria-labelledby="upload-tab"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative border-2 border-dashed rounded-3xl p-16 transition-all duration-300 cursor-pointer group glass',
            isDragging ? 'border-primary bg-primary/5 glow-strong' : 'border-border hover:border-muted-foreground/30 hover:bg-secondary/20',
            isProcessing && 'opacity-50 pointer-events-none'
          )}
        >
          <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.mov,.avi,.webm" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isProcessing} aria-label={TRANSLATIONS.accessibility.fileInput} />

          <div className="flex flex-col items-center gap-6 text-center">
            <div className={cn('w-24 h-24 rounded-3xl glass glass-border flex items-center justify-center transition-all duration-300', isDragging ? 'glow-strong scale-110' : 'group-hover:glow-primary group-hover:scale-105')}>
              <Film className="w-12 h-12 text-primary" aria-hidden="true" />
            </div>

            <div>
              <p className="text-xl font-semibold text-foreground mb-2">{TRANSLATIONS.upload.dragHere}</p>
              <p className="text-muted-foreground">{TRANSLATIONS.upload.orClickToBrowse}</p>
            </div>

            <p className="text-xs text-muted-foreground/60 px-4 py-2 rounded-full bg-secondary/30">{TRANSLATIONS.upload.supportedFormats}</p>
          </div>
        </div>
      ) : (
        <div id="youtube-panel" role="tabpanel" aria-labelledby="youtube-tab" className="glass glass-border apple-shadow rounded-3xl p-10">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-destructive/15 flex items-center justify-center">
                <Link2 className="w-7 h-7 text-destructive" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-lg">{TRANSLATIONS.upload.youtubeVideo}</p>
                <p className="text-sm text-muted-foreground">{TRANSLATIONS.upload.pasteLink}</p>
              </div>
            </div>

            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full h-14 px-5 rounded-2xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 font-mono text-sm transition-all duration-300"
              disabled={isProcessing}
              aria-label={TRANSLATIONS.accessibility.youtubeInput}
              aria-invalid={error ? 'true' : 'false'}
            />

            <Button variant="glow" size="xl" onClick={handleYoutubeSubmit} disabled={!youtubeUrl.trim() || isProcessing || !isValidYoutubeUrl} className="w-full">
              {TRANSLATIONS.upload.processVideo}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};