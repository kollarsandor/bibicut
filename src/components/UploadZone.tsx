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
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2 mb-6 justify-center" role="tablist" aria-label="Feltöltési mód">
        <Button variant={mode === 'upload' ? 'default' : 'outline'} onClick={() => handleModeChange('upload')} disabled={isProcessing} role="tab" aria-selected={mode === 'upload'} aria-controls="upload-panel">
          <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
          {TRANSLATIONS.upload.fileUpload}
        </Button>
        <Button variant={mode === 'youtube' ? 'default' : 'outline'} onClick={() => handleModeChange('youtube')} disabled={isProcessing} role="tab" aria-selected={mode === 'youtube'} aria-controls="youtube-panel">
          <Link2 className="w-4 h-4 mr-2" aria-hidden="true" />
          {TRANSLATIONS.upload.youtubeLink}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm text-center" role="alert">
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
            'relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 cursor-pointer group',
            isDragging ? 'border-primary bg-primary/10 glow-strong' : 'border-border hover:border-primary/50 hover:bg-secondary/50',
            isProcessing && 'opacity-50 pointer-events-none'
          )}
        >
          <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.mov,.avi,.webm" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isProcessing} aria-label={TRANSLATIONS.accessibility.fileInput} />

          <div className="flex flex-col items-center gap-4 text-center">
            <div className={cn('w-20 h-20 rounded-2xl gradient-card flex items-center justify-center transition-all duration-300', isDragging ? 'glow-strong scale-110' : 'group-hover:glow-primary')}>
              <Film className="w-10 h-10 text-primary" aria-hidden="true" />
            </div>

            <div>
              <p className="text-lg font-medium text-foreground mb-1">{TRANSLATIONS.upload.dragHere}</p>
              <p className="text-sm text-muted-foreground">{TRANSLATIONS.upload.orClickToBrowse}</p>
            </div>

            <p className="text-xs text-muted-foreground">{TRANSLATIONS.upload.supportedFormats}</p>
          </div>
        </div>
      ) : (
        <div id="youtube-panel" role="tabpanel" aria-labelledby="youtube-tab" className="gradient-card rounded-2xl p-8 border border-border">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-destructive" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground">{TRANSLATIONS.upload.youtubeVideo}</p>
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
              className="w-full h-12 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              disabled={isProcessing}
              aria-label={TRANSLATIONS.accessibility.youtubeInput}
              aria-invalid={error ? 'true' : 'false'}
            />

            <Button variant="glow" size="lg" onClick={handleYoutubeSubmit} disabled={!youtubeUrl.trim() || isProcessing || !isValidYoutubeUrl} className="w-full">
              {TRANSLATIONS.upload.processVideo}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};