import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "accent"
  | "success"
  | "catalog"
  | "link";

export type ButtonSize = "default" | "sm" | "lg" | "icon" | "catalog";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary-hover",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:opacity-90",
  outline: "border border-input bg-surface text-foreground hover:border-primary hover:bg-muted",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  ghost: "text-foreground hover:bg-muted",
  accent: "bg-accent text-accent-foreground hover:bg-accent-hover",
  success: "bg-success text-success-foreground hover:opacity-90",
  catalog: "h-auto flex-col items-stretch justify-start gap-0 whitespace-normal overflow-hidden rounded-lg border border-border bg-surface p-0 text-left hover:border-primary disabled:opacity-50",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizeStyles: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9 p-0",
  catalog: "h-auto p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size, type = "button", ...props }, ref) => {
    const computedSize = size ?? (variant === "catalog" ? "catalog" : "default");
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
          variantStyles[variant],
          sizeStyles[computedSize],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
