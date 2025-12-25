import { Loader2, CheckCircle2, AlertCircle, Scissors } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ProcessingStatusProps {
  status: 'idle' | 'loading' | 'processing' | 'complete' | 'error';
  progress: number;
  currentStep: string;
  totalChunks: number;
  processedChunks: number;
}

export const ProcessingStatus = ({
  status,
  progress,
  currentStep,
  totalChunks,
  processedChunks,
}: ProcessingStatusProps) => {
  if (status === 'idle') return null;

  return (
    <div className="w-full max-w-2xl mx-auto gradient-card rounded-2xl p-8 border border-border">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
          {status === 'loading' && (
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
          )}
          {status === 'processing' && (
            <Scissors className="w-7 h-7 text-primary animate-pulse" />
          )}
          {status === 'complete' && (
            <CheckCircle2 className="w-7 h-7 text-primary" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-7 h-7 text-destructive" />
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            {status === 'loading' && 'Videó betöltése...'}
            {status === 'processing' && 'Darabolás folyamatban'}
            {status === 'complete' && 'Feldolgozás kész!'}
            {status === 'error' && 'Hiba történt'}
          </h3>
          <p className="text-sm text-muted-foreground">{currentStep}</p>
        </div>
        
        {totalChunks > 0 && (
          <div className="text-right">
            <p className="text-2xl font-mono font-bold text-primary">
              {processedChunks}/{totalChunks}
            </p>
            <p className="text-xs text-muted-foreground">részlet</p>
          </div>
        )}
      </div>
      
      <Progress value={progress} className="h-3" />
      
      <div className="flex justify-between mt-2 text-xs text-muted-foreground font-mono">
        <span>0%</span>
        <span>{Math.round(progress)}%</span>
        <span>100%</span>
      </div>
    </div>
  );
};
