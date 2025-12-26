import { forwardRef, memo, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'glow' | 'success' | 'warning' | 'glass';
  size?: 'default' | 'sm' | 'lg' | 'xl' | 'icon' | 'icon-sm' | 'icon-lg';
  loading?: boolean;
}

const buttonBaseStyles = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]';

const buttonVariantStyles: Record<string, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 apple-shadow-sm',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 apple-shadow-sm',
  outline: 'border border-border bg-transparent text-foreground hover:bg-secondary/50 hover:border-muted-foreground/30',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/70',
  ghost: 'text-foreground hover:bg-secondary/50',
  link: 'text-primary underline-offset-4 hover:underline',
  glow: 'gradient-accent text-primary-foreground font-semibold apple-shadow glow-strong hover:scale-[1.02] active:scale-[0.98]',
  success: 'bg-success text-success-foreground hover:bg-success/90 apple-shadow-sm',
  warning: 'bg-warning text-warning-foreground hover:bg-warning/90 apple-shadow-sm',
  glass: 'glass glass-border text-foreground hover:bg-secondary/30',
};

const buttonSizeStyles: Record<string, string> = {
  default: 'h-11 px-5 py-2.5',
  sm: 'h-9 rounded-lg px-4 text-xs',
  lg: 'h-12 rounded-xl px-8 text-base',
  xl: 'h-14 rounded-2xl px-10 text-lg font-semibold',
  icon: 'h-11 w-11',
  'icon-sm': 'h-9 w-9 rounded-lg',
  'icon-lg': 'h-12 w-12',
};

export const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', loading = false, disabled, children, ...props }, ref) => {
    const isDisabled = disabled || loading;
    const variantStyle = buttonVariantStyles[variant] || buttonVariantStyles.default;
    const sizeStyle = buttonSizeStyles[size] || buttonSizeStyles.default;
    const loadingStyle = loading ? 'relative text-transparent pointer-events-none' : '';
    const finalClassName = `${buttonBaseStyles} ${variantStyle} ${sizeStyle} ${loadingStyle} ${className}`.trim();

    return (
      <button
        ref={ref}
        className={finalClassName}
        disabled={isDisabled}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {children}
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </span>
        )}
      </button>
    );
  }
));

Button.displayName = 'Button';

export interface ProgressProps {
  value?: number;
  max?: number;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}

const progressVariantStyles: Record<string, string> = {
  default: 'gradient-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

export const Progress = memo(forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, max = 100, variant = 'default', className = '', ...props }, ref) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const variantStyle = progressVariantStyles[variant] || progressVariantStyles.default;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={`relative h-3 w-full overflow-hidden rounded-full bg-secondary ${className}`}
        {...props}
      >
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${variantStyle}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  }
));

Progress.displayName = 'Progress';

export interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastIdCounter = 0;
const toastListeners = new Set<() => void>();
let toastState: ToastData[] = [];

function notifyToastListeners(): void {
  const listeners = Array.from(toastListeners);
  const len = listeners.length;
  for (let i = 0; i < len; i++) {
    listeners[i]();
  }
}

export function toast(data: Omit<ToastData, 'id'>): string {
  const id = `toast-${++toastIdCounter}`;
  const newToast: ToastData = { ...data, id };
  toastState = [...toastState, newToast];
  notifyToastListeners();

  setTimeout(() => {
    dismissToast(id);
  }, 4000);

  return id;
}

export function dismissToast(id: string): void {
  toastState = toastState.filter(t => t.id !== id);
  notifyToastListeners();
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>(() => toastState);

  useEffect(() => {
    const listener = (): void => {
      setToasts([...toastState]);
    };
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  return {
    toasts,
    toast,
    dismiss: dismissToast,
  };
}

export const Toaster = memo(function Toaster(): JSX.Element {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass glass-border apple-shadow rounded-2xl p-4 animate-fade-in ${
            t.variant === 'destructive' ? 'border-destructive/30' : ''
          }`}
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className={`font-semibold ${t.variant === 'destructive' ? 'text-destructive' : 'text-foreground'}`}>
                {t.title}
              </p>
              {t.description && (
                <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Bezárás"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export const Dialog = memo(function Dialog({ open, onOpenChange, children }: DialogProps): JSX.Element | null {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto backdrop:bg-black/80 backdrop:backdrop-blur-sm bg-transparent p-0 max-w-lg w-full"
      onClose={handleClose}
      onClick={handleBackdropClick}
    >
      <div className="glass glass-border apple-shadow rounded-3xl p-6 animate-fade-in">
        {children}
      </div>
    </dialog>
  );
});

export interface AccordionItemData {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItemData[];
  className?: string;
}

export const Accordion = memo(function Accordion({ items, className = '' }: AccordionProps): JSX.Element {
  return (
    <div className={className}>
      {items.map((item) => (
        <details key={item.id} className="group border-b border-border">
          <summary className="list-none cursor-pointer flex justify-between items-center py-4 font-medium text-foreground hover:text-primary transition-colors">
            {item.title}
            <span className="transition-transform duration-200 group-open:rotate-180 text-muted-foreground">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </summary>
          <div className="pb-4 text-muted-foreground animate-fade-in">
            {item.content}
          </div>
        </details>
      ))}
    </div>
  );
});

export const Skeleton = memo(function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return (
    <div className={`skeleton rounded-lg ${className}`} />
  );
});

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip = memo(function Tooltip({ content, children, side = 'top' }: TooltipProps): JSX.Element {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  }, []);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setVisible(false);
  }, []);

  const positionClass = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }[side];

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div className={`absolute ${positionClass} z-50 px-3 py-1.5 text-xs bg-popover text-popover-foreground rounded-lg apple-shadow-sm animate-fade-in whitespace-nowrap`}>
          {content}
        </div>
      )}
    </div>
  );
});

export const ScissorsIcon = memo(function ScissorsIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2"/>
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const RefreshIcon = memo(function RefreshIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.1826 3 17.9885 4.67433 19.6633 7.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M21 3V7.5H16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const SparklesIcon = memo(function SparklesIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L13.09 8.26L19 10L13.09 11.74L12 18L10.91 11.74L5 10L10.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 18L5.5 16L7 15.5L5.5 15L5 13L4.5 15L3 15.5L4.5 16L5 18Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M19 8L19.5 6L21 5.5L19.5 5L19 3L18.5 5L17 5.5L18.5 6L19 8Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const UploadIcon = memo(function UploadIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const FilmIcon = memo(function FilmIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="2.18" stroke="currentColor" strokeWidth="2"/>
      <path d="M7 2V22" stroke="currentColor" strokeWidth="2"/>
      <path d="M17 2V22" stroke="currentColor" strokeWidth="2"/>
      <path d="M2 12H22" stroke="currentColor" strokeWidth="2"/>
      <path d="M2 7H7" stroke="currentColor" strokeWidth="2"/>
      <path d="M2 17H7" stroke="currentColor" strokeWidth="2"/>
      <path d="M17 17H22" stroke="currentColor" strokeWidth="2"/>
      <path d="M17 7H22" stroke="currentColor" strokeWidth="2"/>
    </svg>
  );
});

export const LinkIcon = memo(function LinkIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 13C10.4295 13.5741 10.9774 14.0492 11.6066 14.3929C12.2357 14.7367 12.9315 14.9411 13.6467 14.9923C14.3618 15.0435 15.0796 14.9403 15.7513 14.6897C16.4231 14.4392 17.0331 14.047 17.54 13.54L20.54 10.54C21.4508 9.59699 21.9548 8.33397 21.9434 7.02299C21.932 5.71201 21.4061 4.45794 20.4791 3.5309C19.5521 2.60386 18.298 2.07802 16.987 2.06663C15.676 2.05523 14.413 2.55921 13.47 3.47L11.75 5.18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 11C13.5705 10.4259 13.0226 9.95083 12.3934 9.60707C11.7642 9.26331 11.0685 9.05889 10.3533 9.00768C9.63816 8.95646 8.92037 9.05964 8.24861 9.31023C7.57685 9.56082 6.96687 9.953 6.46 10.46L3.46 13.46C2.54921 14.403 2.04524 15.666 2.05663 16.977C2.06802 18.288 2.59387 19.5421 3.52091 20.4691C4.44795 21.3961 5.70201 21.922 7.013 21.9334C8.32398 21.9448 9.58699 21.4408 10.53 20.53L12.24 18.82" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const DownloadIcon = memo(function DownloadIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const FileVideoIcon = memo(function FileVideoIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 11L15 14L10 17V11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const ClockIcon = memo(function ClockIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const LoaderIcon = memo(function LoaderIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={`${className} animate-spin`} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C15.3137 3 18.1954 4.83685 19.7434 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
});

export const CheckCircleIcon = memo(function CheckCircleIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});

export const AlertCircleIcon = memo(function AlertCircleIcon({ className = '' }: { className?: string }): JSX.Element {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
});
