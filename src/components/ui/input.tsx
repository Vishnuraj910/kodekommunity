import * as React from "react";
import { cn } from "../../lib/utils";

export function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">): React.JSX.Element {
  return (
    <input
      className={cn("ui-input", className)}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}
