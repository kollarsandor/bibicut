import { memo, useCallback, useMemo } from 'react';
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
  const minsStr = mins < 10 ? '0' + mins : String(mins);
  const secsStr = secs < 10 ? '0' + secs : String(secs);
  return minsStr + ':' + secsStr;
};

interface ChunkItemProps {
  chunk: VideoChunk;
  index: number;
  onDownload: (chunk: VideoChunk) => void;
}

const ChunkItem = memo(({ chunk, index, onDownload }: ChunkItemProps) => {
  const handleClick = useCallback(() => {
    onDownload(chunk);
  }, [chunk, onDownload]);

  const timeRange = useMemo(() => 
    formatTime(chunk.startTime) + ' – ' + formatTime(chunk.endTime),
    [chunk.startTime, chunk.endTime]
  );

  return (
    <div 
      className="flex items-center gap-4 p-5 rounded-2xl bg-secondary/30 border border-border hover:border-muted-foreground/20 hover:bg-secondary/50 transition-all duration-300 group apple-hover" 
      role="listitem"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
        <FileVideo className="w-6 h-6 text-primary" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate font-mono text-sm">{chunk.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
          <Clock className="w-3 h-3" aria-hidden="true" />
          <span>{timeRange}</span>
        </div>
      </div>

      <Button 
        variant="ghost" 
        size="icon-sm" 
        onClick={handleClick} 
        className="opacity-0 group-hover:opacity-100 transition-all duration-300" 
        aria-label={`${TRANSLATIONS.accessibility.downloadChunk}: ${chunk.name}`}
      >
        <Download className="w-4 h-4" aria-hidden="true" />
      </Button>
    </div>
  );
});

ChunkItem.displayName = 'ChunkItem';

export const DownloadSection = memo(({ chunks, onDownloadAll, onDownloadSingle, isDownloading }: DownloadSectionProps) => {
  const chunksLen = chunks.length;
  
  if (chunksLen === 0) return null;

  const chunkCountText = useMemo(() => TRANSLATIONS.download.chunkCount(chunksLen), [chunksLen]);

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      <div className="glass glass-border apple-shadow rounded-3xl p-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-semibold text-foreground">{TRANSLATIONS.download.videoChunks}</h3>
            <p className="text-muted-foreground mt-1">{chunkCountText}</p>
          </div>

          <Button 
            variant="glow" 
            size="lg" 
            onClick={onDownloadAll} 
            disabled={isDownloading} 
            aria-label={TRANSLATIONS.accessibility.downloadAll} 
            className="apple-hover"
          >
            <Download className="w-5 h-5 mr-2" aria-hidden="true" />
            {TRANSLATIONS.download.downloadZip}
          </Button>
        </div>

        <div className="grid gap-3 max-h-80 overflow-y-auto pr-2 no-scrollbar" role="list" aria-label={TRANSLATIONS.download.videoChunks}>
          {chunks.map((chunk, index) => (
            <ChunkItem 
              key={chunk.name + '-' + index} 
              chunk={chunk} 
              index={index} 
              onDownload={onDownloadSingle} 
            />
          ))}
        </div>
      </div>
    </div>
  );
});

DownloadSection.displayName = 'DownloadSection';
