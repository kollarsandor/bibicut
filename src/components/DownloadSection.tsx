import { Download, FileVideo, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { VideoChunk } from '@/types/video';
import { TRANSLATIONS } from '@/constants/translations';

interface DownloadSectionProps {
  chunks: VideoChunk[];
  onDownloadAll: () => void;
  onDownloadSingle: (chunk: VideoChunk) => void;
  isDownloading: boolean;
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const DownloadSection = ({ chunks, onDownloadAll, onDownloadSingle, isDownloading }: DownloadSectionProps) => {
  if (chunks.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="gradient-card rounded-2xl p-8 border border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-foreground">{TRANSLATIONS.download.videoChunks}</h3>
            <p className="text-sm text-muted-foreground">{TRANSLATIONS.download.chunkCount(chunks.length)}</p>
          </div>

          <Button variant="glow" size="lg" onClick={onDownloadAll} disabled={isDownloading} aria-label={TRANSLATIONS.accessibility.downloadAll}>
            <Download className="w-5 h-5 mr-2" aria-hidden="true" />
            {TRANSLATIONS.download.downloadZip}
          </Button>
        </div>

        <div className="grid gap-2 max-h-80 overflow-y-auto pr-2" role="list" aria-label={TRANSLATIONS.download.videoChunks}>
          {chunks.map((chunk, index) => (
            <div key={`${chunk.name}-${index}`} className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 transition-all group" role="listitem">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileVideo className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate font-mono text-sm">{chunk.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  <span>
                    {formatTime(chunk.startTime)} – {formatTime(chunk.endTime)}
                  </span>
                </div>
              </div>

              <Button variant="ghost" size="sm" onClick={() => onDownloadSingle(chunk)} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`${TRANSLATIONS.accessibility.downloadChunk}: ${chunk.name}`}>
                <Download className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};