"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface DialogContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextType | null>(null);

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  return (
    <DialogContext.Provider value={{ open: Boolean(open), setOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) return <>{children}</>;

  if (React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => {
        (children as React.ReactElement<{ onClick?: () => void }>).props.onClick?.();
        ctx.setOpen(true);
      },
    });
  }

  return <button type="button" onClick={() => ctx.setOpen(true)}>{children}</button>;
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

export function DialogClose({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx) return null;

  if (children && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => {
        (children as React.ReactElement<{ onClick?: () => void }>).props.onClick?.();
        ctx.setOpen(false);
      },
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute right-3 top-3"
      aria-label="Đóng"
      onClick={() => ctx.setOpen(false)}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </Button>
  );
}

export function DialogOverlay({ className }: { className?: string }) {
  const ctx = React.useContext(DialogContext);
  if (!ctx?.open) return null;
  return (
    <div
      aria-hidden="true"
      onClick={() => ctx.setOpen(false)}
      className={cn("fixed inset-0 z-50 bg-overlay backdrop-blur-xs transition-opacity animate-in fade-in-0", className)}
    />
  );
}

export function DialogContent({
  className,
  children,
  onEscapeKeyDown,
}: {
  className?: string;
  children: React.ReactNode;
  onEscapeKeyDown?: () => void;
}) {
  const ctx = React.useContext(DialogContext);

  React.useEffect(() => {
    if (!ctx?.open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscapeKeyDown?.();
        ctx.setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ctx, onEscapeKeyDown]);

  if (!ctx?.open) return null;

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-24px)] max-w-lg max-h-[calc(100dvh-32px)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 rounded-xl border border-border bg-surface p-5 shadow-modal duration-200 animate-in fade-in-0 zoom-in-95",
          className
        )}
      >
        {children}
        <DialogClose />
      </div>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold leading-none tracking-tight text-foreground", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
