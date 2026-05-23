import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onClick, ...props }, ref) => {
    const isTemporalInput = type === "date" || type === "time" || type === "datetime-local";

    const handleClick = (event: React.MouseEvent<HTMLInputElement>) => {
      onClick?.(event);
      if (!isTemporalInput) {
        return;
      }

      const element = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
      if (typeof element.showPicker === "function") {
        try {
          element.showPicker();
        } catch {
          // Ignore browsers that block showPicker outside trusted interactions.
        }
      }
    };

    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          isTemporalInput && "cursor-pointer pr-2 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:rounded-md [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:transition-opacity [&::-webkit-calendar-picker-indicator]:duration-200 hover:[&::-webkit-calendar-picker-indicator]:opacity-100",
          className,
        )}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
