import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 apple-shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 apple-shadow-sm",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary/50 hover:border-muted-foreground/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: 
          "text-foreground hover:bg-secondary/50",
        link: 
          "text-primary underline-offset-4 hover:underline",
        glow: 
          "gradient-accent text-primary-foreground font-semibold apple-shadow glow-strong hover:scale-[1.02] active:scale-[0.98]",
        success:
          "bg-success text-success-foreground hover:bg-success/90 apple-shadow-sm",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 apple-shadow-sm",
        glass:
          "glass glass-border text-foreground hover:bg-secondary/30",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg font-semibold",
        icon: "h-11 w-11",
        "icon-sm": "h-9 w-9 rounded-lg",
        "icon-lg": "h-12 w-12",
      },
      loading: {
        true: "relative text-transparent pointer-events-none",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      loading: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, asChild = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, loading, className }))}
        ref={ref}
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
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
