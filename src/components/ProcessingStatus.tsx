import { forwardRef } from 'react';
import { Loader2, CheckCircle2, AlertCircle, Scissors } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { ProcessingStatus } from '@/types/video';
import { TRANSLATIONS } from '@/constants/translations';

interface ProcessingStatusProps {
  status: ProcessingStatus;
  progress: number;
  currentStep: string;
  totalChunks: number;
  processedChunks: number;
}

export const ProcessingStatusComponent = forwardRef<HTMLDivElement, ProcessingStatusProps>(
  ({ status, progress, currentStep, totalChunks, processedChunks }, ref) => {
    if (status === 'idle') return null;

    const getStatusTitle = (): string => {
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

    return (
      <div ref={ref} className="w-full max-w-2xl mx-auto glass glass-border apple-shadow rounded-3xl p-10 animate-fade-in" role="region" aria-live="polite" aria-label={TRANSLATIONS.accessibility.progressBar}>
        <div className="flex items-center gap-5 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            {status === 'loading' && <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />}
            {status === 'processing' && <Scissors className="w-8 h-8 text-primary animate-pulse" aria-hidden="true" />}
            {status === 'complete' && <CheckCircle2 className="w-8 h-8 text-success" aria-hidden="true" />}
            {status === 'error' && <AlertCircle className="w-8 h-8 text-destructive" aria-hidden="true" />}
          </div>

          <div className="flex-1">
            <h3 className="text-xl font-semibold text-foreground">{getStatusTitle()}</h3>
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

        <Progress value={progress} aria-label={TRANSLATIONS.accessibility.progressBar} aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} className="h-3" />

        <div className="flex justify-between mt-3 text-xs text-muted-foreground/60 font-mono">
          <span>0%</span>
          <span className="text-primary font-medium">{Math.round(progress)}%</span>
          <span>100%</span>
        </div>
      </div>
    );
  }
);

ProcessingStatusComponent.displayName = 'ProcessingStatus';

export { ProcessingStatusComponent as ProcessingStatus };