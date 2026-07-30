import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

export const Tabs = ({
  className = "",
  ...props
}: ComponentProps<typeof TabsPrimitive.Root>): React.JSX.Element => (
  <TabsPrimitive.Root
    className={cn("ui-tabs", className)}
    data-slot="tabs"
    {...props}
  />
);

export const TabsList = ({
  className = "",
  ...props
}: ComponentProps<typeof TabsPrimitive.List>): React.JSX.Element => (
  <TabsPrimitive.List
    className={cn(className)}
    data-slot="tabs-list"
    {...props}
  />
);

export const TabsTrigger = ({
  className = "",
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>): React.JSX.Element => (
  <TabsPrimitive.Trigger
    className={cn(className)}
    data-slot="tabs-trigger"
    {...props}
  />
);

export const TabsContent = ({
  className = "",
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>): React.JSX.Element => (
  <TabsPrimitive.Content
    className={cn(className)}
    data-slot="tabs-content"
    {...props}
  />
);
