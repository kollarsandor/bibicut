import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-secondary/50",
  {
    variants: {
      size: {
        default: "h-3",
        sm: "h-2",
        lg: "h-4",
        xl: "h-6",
      },
      variant: {
        default: "",
        success: "",
        warning: "",
        destructive: "",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
);

const indicatorVariants = cva(
  "h-full w-full flex-1 transition-all duration-500 ease-out relative overflow-hidden rounded-full",
  {
    variants: {
      variant: {
        default: "gradient-accent",
        success: "bg-success",
        warning: "bg-warning",
        destructive: "bg-destructive",
      },
      animated: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      animated: true,
    },
  }
);

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>,
    VariantProps<typeof progressVariants> {
  animated?: boolean;
  showValue?: boolean;
  label?: string;
}

const Progress = React.memo(React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, size, variant, animated = true, showValue = false, label, ...props }, ref) => {
  const safeValue = Math.min(100, Math.max(0, value ?? 0));
  const ariaLabel = label ?? "Feldolgozási folyamat";

  const transformStyle = React.useMemo(() => ({ 
    transform: `translateX(-${100 - safeValue}%)` 
  }), [safeValue]);

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-foreground">{label}</span>
          )}
          {showValue && (
            <span className="text-sm font-mono text-muted-foreground">
              {Math.round(safeValue)}%
            </span>
          )}
        </div>
      )}
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(progressVariants({ size, variant }), className)}
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={100}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className={cn(indicatorVariants({ variant, animated }))}
          style={transformStyle}
        >
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/10 to-transparent animate-shimmer" />
          )}
        </ProgressPrimitive.Indicator>
      </ProgressPrimitive.Root>
    </div>
  );
}));

Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress, progressVariants, indicatorVariants };
