"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectSheet } from "./create-project-sheet";
import { cn } from "@/lib/utils";

interface NewProjectButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  label?: string;
  className?: string;
}

export function NewProjectButton({
  variant = "default",
  size = "default",
  label = "New Project",
  className,
}: NewProjectButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={cn(
          variant === "default" &&
            "bg-gradient-to-br from-primary to-violet-600 hover:from-primary/95 hover:to-violet-600/95 text-white border-0 shadow-soft",
          className
        )}
      >
        <Plus className="h-4 w-4 mr-1.5" />
        {label}
      </Button>
      <CreateProjectSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
