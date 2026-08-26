"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { widgetDefinition } from "@/lib/widgets/registry";
import {
  DATE_WINDOW_VALUES,
  TASK_PRIORITY_VALUES,
  TASK_STATUS_VALUES,
  TasksConfigSchema,
  type TasksConfig,
  type WidgetInstance,
} from "@/lib/widgets/schema";
import { updateConfigAction } from "@/lib/widgets/layout-actions";

/**
 * V0.28 Phase B — Configure sheet.
 *
 * Widget-specific: each widget type has its own form (no generic
 * key/value editor). Tasks ships fully in Phase B; other types show a
 * short read-only summary + the title editor, with their full config
 * forms landing in Phase C.
 */
export function ConfigureSheet({
  instance,
  onClose,
}: {
  instance: WidgetInstance | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={!!instance} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[440px] sm:max-w-[440px] bg-[var(--denoise-surface)] border-l border-[var(--denoise-border-strong)]"
      >
        {instance && <Body instance={instance} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function Body({
  instance,
  onClose,
}: {
  instance: WidgetInstance;
  onClose: () => void;
}) {
  const def = widgetDefinition(instance.type);
  return (
    <>
      <SheetHeader className="border-b border-[var(--denoise-border)]">
        <SheetTitle className="text-[var(--denoise-cream)]">
          Configure {def.name}
        </SheetTitle>
        <SheetDescription className="text-[12px] text-[var(--denoise-cream-muted)]">
          {def.description}
        </SheetDescription>
      </SheetHeader>
      <div className="p-4 overflow-auto flex-1">
        {instance.type === "tasks" ? (
          <TasksForm instance={instance} onDone={onClose} />
        ) : (
          <PhaseCPlaceholder instance={instance} onDone={onClose} />
        )}
      </div>
    </>
  );
}

// ── Tasks form ──────────────────────────────────────────────────────

function TasksForm({
  instance,
  onDone,
}: {
  instance: Extract<WidgetInstance, { type: "tasks" }>;
  onDone: () => void;
}) {
  const [config, setConfig] = useState<TasksConfig>(instance.config);
  const [title, setTitle] = useState(instance.title ?? "");
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      try {
        const validated = TasksConfigSchema.parse(config);
        await updateConfigAction({
          instanceId: instance.id,
          config: validated,
        });
        toast.success("Widget updated");
        onDone();
      } catch (err) {
        console.error(err);
        toast.error("Couldn't save configuration");
      }
    });
  };

  return (
    <div className="space-y-5 text-[13px]">
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Optional label — defaults to 'Tasks'"
          className="h-9 bg-[var(--denoise-bg)] border-[var(--denoise-border)]"
        />
      </Field>

      <Field label="Scope">
        <RadioGroup
          value={config.scope.kind}
          onChange={(v) => {
            const map: Record<string, TasksConfig["scope"]> = {
              all: { kind: "all" },
              mine: { kind: "mine" },
              assigned: { kind: "assigned" },
            };
            setConfig({ ...config, scope: map[v] });
          }}
          options={[
            { value: "all", label: "All accessible projects" },
            { value: "mine", label: "Projects I'm a member of" },
            { value: "assigned", label: "Projects with tasks assigned to me" },
          ]}
        />
      </Field>

      <Field label="Assignee">
        <RadioGroup
          value={config.assignee.kind}
          onChange={(v) => {
            const map: Record<string, TasksConfig["assignee"]> = {
              me: { kind: "me" },
              everyone: { kind: "everyone" },
              unassigned: { kind: "unassigned" },
            };
            setConfig({ ...config, assignee: map[v] });
          }}
          options={[
            { value: "me", label: "Me" },
            { value: "everyone", label: "Everyone" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
      </Field>

      <Field label="Status">
        <ChipMultiSelect
          values={TASK_STATUS_VALUES as unknown as string[]}
          selected={config.statuses}
          onToggle={(v) => {
            const set = new Set(config.statuses);
            if (set.has(v as (typeof TASK_STATUS_VALUES)[number])) {
              set.delete(v as (typeof TASK_STATUS_VALUES)[number]);
            } else set.add(v as (typeof TASK_STATUS_VALUES)[number]);
            setConfig({
              ...config,
              statuses: Array.from(set) as typeof config.statuses,
            });
          }}
          labelFor={(s) => s.replace(/_/g, " ")}
        />
      </Field>

      <Field label="Priority">
        <ChipMultiSelect
          values={TASK_PRIORITY_VALUES as unknown as string[]}
          selected={config.priorities}
          onToggle={(v) => {
            const set = new Set(config.priorities);
            if (set.has(v as (typeof TASK_PRIORITY_VALUES)[number])) {
              set.delete(v as (typeof TASK_PRIORITY_VALUES)[number]);
            } else set.add(v as (typeof TASK_PRIORITY_VALUES)[number]);
            setConfig({
              ...config,
              priorities: Array.from(set) as typeof config.priorities,
            });
          }}
        />
      </Field>

      <Field label="Due">
        <div className="grid grid-cols-2 gap-1.5">
          {DATE_WINDOW_VALUES.map((w) => {
            const active = config.dateWindows.includes(w);
            return (
              <label
                key={w}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer",
                  active
                    ? "border-[var(--denoise-copper-border)] bg-[var(--denoise-copper-muted)]"
                    : "border-[var(--denoise-border)] bg-[var(--denoise-bg)]"
                )}
              >
                <Checkbox
                  checked={active}
                  onCheckedChange={() => {
                    const set = new Set(config.dateWindows);
                    if (set.has(w)) set.delete(w);
                    else set.add(w);
                    setConfig({
                      ...config,
                      dateWindows: Array.from(set) as typeof config.dateWindows,
                    });
                  }}
                />
                <span className="text-[12px] text-[var(--denoise-cream)] capitalize">
                  {w.replace(/_/g, " ")}
                </span>
              </label>
            );
          })}
        </div>
      </Field>

      <Field label="Sort by">
        <Select
          value={config.sortBy}
          onChange={(v) =>
            setConfig({
              ...config,
              sortBy: v as TasksConfig["sortBy"],
            })
          }
          options={[
            { value: "due", label: "Due date" },
            { value: "priority", label: "Priority" },
            { value: "updated", label: "Recently updated" },
            { value: "created", label: "Recently created" },
            { value: "project", label: "Project" },
          ]}
        />
      </Field>

      <div className="pt-3 border-t border-[var(--denoise-border)] flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onDone}
          className="h-9"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={save}
          disabled={pending}
          className="h-9 !bg-[var(--denoise-copper)] hover:!bg-[var(--denoise-copper-strong)] !text-black"
        >
          Save
        </Button>
      </div>
    </div>
  );
}

// ── Placeholder for widgets whose config UI ships in Phase C ────────

function PhaseCPlaceholder({
  instance,
  onDone,
}: {
  instance: WidgetInstance;
  onDone: () => void;
}) {
  return (
    <div className="space-y-4 text-[13px]">
      <div className="rounded-[var(--radius-home)] border border-[var(--denoise-border)] bg-[var(--denoise-bg)] p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--denoise-copper)]">
          Config UI ships next phase
        </p>
        <p className="text-[12px] text-[var(--denoise-cream-muted)] mt-2 leading-relaxed">
          This widget renders correctly and respects access control. Its
          dedicated configuration form is scheduled for the next release —
          the underlying config schema is already persisted and validated.
        </p>
      </div>
      <pre className="text-[11px] text-[var(--denoise-cream-muted)] bg-[var(--denoise-bg)] rounded-md p-3 overflow-auto max-h-[240px]">
        {JSON.stringify(instance.config, null, 2)}
      </pre>
      <div className="flex justify-end">
        <Button variant="outline" onClick={onDone} className="h-9">
          Close
        </Button>
      </div>
    </div>
  );
}

// ── tiny form primitives (Home-local) ───────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.18em] text-[var(--denoise-cream-muted)]">
        {label}
      </Label>
      {children}
    </div>
  );
}

function RadioGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            "flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer",
            value === o.value
              ? "border-[var(--denoise-copper-border)] bg-[var(--denoise-copper-muted)]"
              : "border-[var(--denoise-border)] bg-[var(--denoise-bg)]"
          )}
        >
          <input
            type="radio"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="accent-[var(--denoise-copper)]"
          />
          <span className="text-[12px] text-[var(--denoise-cream)]">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}

function ChipMultiSelect({
  values,
  selected,
  onToggle,
  labelFor,
}: {
  values: string[];
  selected: string[];
  onToggle: (v: string) => void;
  labelFor?: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => {
        const active = selected.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            className={cn(
              "text-[11px] uppercase tracking-[0.14em] px-2.5 h-7 rounded-md border transition-colors capitalize",
              active
                ? "border-[var(--denoise-copper-border)] bg-[var(--denoise-copper-muted)] text-[var(--denoise-copper)]"
                : "border-[var(--denoise-border)] bg-[var(--denoise-bg)] text-[var(--denoise-cream-muted)] hover:text-[var(--denoise-cream)]"
            )}
          >
            {labelFor ? labelFor(v) : v}
          </button>
        );
      })}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 bg-[var(--denoise-bg)] border border-[var(--denoise-border)] rounded-md px-3 text-[12px] text-[var(--denoise-cream)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
