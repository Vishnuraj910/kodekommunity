import * as React from "react";
import { cn } from "../../lib/utils";

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">): React.JSX.Element {
  return (
    <textarea
      className={cn("ui-textarea", className)}
      data-slot="textarea"
      {...props}
    />
  );
}
