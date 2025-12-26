import { memo } from 'react';
import { Progress, LoaderIcon, ScissorsIcon, CheckCircleIcon, AlertCircleIcon } from '@/components/ui/ui';
import type { ProcessingStatus as ProcessingStatusType } from '@/types/video';
import { TRANSLATIONS } from '@/constants/translations';

interface ProcessingStatusProps {
  status: ProcessingStatusType;
  progress: number;
  currentStep: string;
  totalChunks: number;
  processedChunks: number;
}

const StatusIcon = memo(function StatusIcon({ status }: { status: ProcessingStatusType }) {
  switch (status) {
    case 'loading':
      return <LoaderIcon className="w-8 h-8 text-primary" aria-hidden="true" />;
    case 'processing':
      return <ScissorsIcon className="w-8 h-8 text-primary animate-pulse" aria-hidden="true" />;
    case 'complete':
      return <CheckCircleIcon className="w-8 h-8 text-success" aria-hidden="true" />;
    case 'error':
      return <AlertCircleIcon className="w-8 h-8 text-destructive" aria-hidden="true" />;
    default:
      return null;
  }
});

const getStatusTitle = (status: ProcessingStatusType): string => {
  switch (status) {
    case 'loading':
      return TRANSLATIONS.status.loading;
    case 'processing':
      return TRANSLATIONS.status.processing;
    case 'complete':
      return TRANSLATIONS.status.complete;
    case 'error':
      return TRANSLATIONS.status.error;
    default:
      return '';
  }
};

export const ProcessingStatus = memo(function ProcessingStatus({ status, progress, currentStep, totalChunks, processedChunks }: ProcessingStatusProps) {
  if (status === 'idle') return null;

  const statusTitle = getStatusTitle(status);
  const progressPercent = Math.round(progress);

  return (
    <div 
      className="w-full max-w-2xl mx-auto glass glass-border apple-shadow rounded-3xl p-10 animate-fade-in" 
      role="region" 
      aria-live="polite" 
      aria-label={TRANSLATIONS.accessibility.progressBar}
    >
      <div className="flex items-center gap-5 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
          <StatusIcon status={status} />
        </div>

        <div className="flex-1">
          <h3 className="text-xl font-semibold text-foreground">{statusTitle}</h3>
          <p className="text-muted-foreground mt-1">{currentStep}</p>
        </div>

        {totalChunks > 0 && (
          <div className="text-right">
            <p className="text-3xl font-mono font-bold text-primary">
              {processedChunks}/{totalChunks}
            </p>
            <p className="text-xs text-muted-foreground">{TRANSLATIONS.status.chunk}</p>
          </div>
        )}
      </div>

      <Progress 
        value={progress} 
        aria-label={TRANSLATIONS.accessibility.progressBar} 
        aria-valuenow={progressPercent} 
        aria-valuemin={0} 
        aria-valuemax={100} 
        className="h-3" 
      />

      <div className="flex justify-between mt-3 text-xs text-muted-foreground/60 font-mono">
        <span>0%</span>
        <span className="text-primary font-medium">{progressPercent}%</span>
        <span>100%</span>
      </div>
    </div>
  );
});
