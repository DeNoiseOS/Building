"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { CommentThread } from "@/components/shared/comment-thread";
import { toast } from "sonner";
import {
  TASK_STATUS,
  TASK_PRIORITY,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/roles";

interface TaskValues {
  id?: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  section: string | null;
  dueDate: string | null;
  assigneeId: string | null;
}

type Mode = "create" | "edit";

export interface ProjectChoice {
  id: string;
  name: string;
}

interface TaskEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  /** Required in create mode unless projectChoices is provided. */
  projectId?: string;
  /** When provided, shows a project picker in create mode (global Tasks page). */
  projectChoices?: ProjectChoice[];
  /** Required in edit mode. */
  task?: {
    id: string;
    projectId: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    section: string | null;
    dueDate: string | null;
    assigneeId: string | null;
  };
  /** Pre-set section when launched from a workspace surface. */
  initialSection?: string;
  /** Current user; "Me" option in assignee picker. */
  currentUser: { id: string; name: string };
  /** V0.6 — when true the sheet renders disabled & cannot submit. */
  readOnly?: boolean;
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function dateInputToIso(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function TaskEditSheet({
  open,
  onOpenChange,
  mode,
  projectId,
  projectChoices,
  task,
  initialSection,
  currentUser,
  readOnly = false,
}: TaskEditSheetProps) {
  const router = useRouter();

  const initialProjectId =
    task?.projectId ?? projectId ?? projectChoices?.[0]?.id ?? "";

  const [chosenProjectId, setChosenProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(
    (task?.status as TaskStatus) ?? "todo"
  );
  const [priority, setPriority] = useState<TaskPriority>(
    (task?.priority as TaskPriority) ?? "medium"
  );
  const [section, setSection] = useState<string>(
    task?.section ?? initialSection ?? ""
  );
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate));
  const [assigneeId, setAssigneeId] = useState<string>(
    task?.assigneeId ?? ""
  );
  const [departmentId, setDepartmentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [memberOptions, setMemberOptions] = useState<
    { id: string; name: string; departmentIds: string[] }[]
  >([]);
  const [departments, setDepartments] = useState<
    { id: string; name: string }[]
  >([]);

  // V0.5: two-stage assignment.
  // Fetch project members + departments. Each member carries a list of
  // department IDs they belong to so the picker can scope by department.
  useEffect(() => {
    if (!open || !chosenProjectId) {
      setMemberOptions([]);
      setDepartments([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetch(`/api/projects/${chosenProjectId}/members`).then((r) =>
        r.ok ? r.json() : { members: [] }
      ),
      fetch(`/api/projects/${chosenProjectId}/departments`).then((r) =>
        r.ok ? r.json() : { departments: [] }
      ),
    ])
      .then(async ([membersData, deptData]) => {
        if (cancelled) return;
        const depts: { id: string; name: string }[] = (
          deptData.departments ?? []
        ).map((d: { id: string; name: string }) => ({
          id: d.id,
          name: d.name,
        }));
        setDepartments(depts);
        // For each dept fetch member roster so we know who lives where.
        const rosters = await Promise.all(
          depts.map((d) =>
            fetch(
              `/api/projects/${chosenProjectId}/departments/${d.id}`
            )
              .then((r) => (r.ok ? r.json() : null))
              .then((j) => ({
                deptId: d.id,
                userIds: (j?.members ?? []).map(
                  (m: { userId: string }) => m.userId
                ),
              }))
          )
        );
        if (cancelled) return;
        const userDept: Record<string, string[]> = {};
        rosters.forEach(({ deptId, userIds }) => {
          userIds.forEach((uid: string) => {
            userDept[uid] = userDept[uid] ?? [];
            userDept[uid].push(deptId);
          });
        });

        const list: { id: string; name: string; departmentIds: string[] }[] = (
          membersData.members ?? []
        ).map((m: { userId: string; name: string }) => ({
          id: m.userId,
          name: m.name,
          departmentIds: userDept[m.userId] ?? [],
        }));
        if (!list.some((m) => m.id === currentUser.id)) {
          list.unshift({
            id: currentUser.id,
            name: currentUser.name,
            departmentIds: userDept[currentUser.id] ?? [],
          });
        }
        setMemberOptions(list);
      })
      .catch(() => {
        if (!cancelled) {
          setMemberOptions([
            { id: currentUser.id, name: currentUser.name, departmentIds: [] },
          ]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, chosenProjectId, currentUser.id, currentUser.name]);

  useEffect(() => {
    if (!open) return;
    setChosenProjectId(task?.projectId ?? projectId ?? projectChoices?.[0]?.id ?? "");
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus((task?.status as TaskStatus) ?? "todo");
    setPriority((task?.priority as TaskPriority) ?? "medium");
    setSection(task?.section ?? initialSection ?? "");
    setDueDate(toDateInput(task?.dueDate));
    setAssigneeId(task?.assigneeId ?? "");
    // V0.5: hydrate ownerDepartment from existing task if present.
    setDepartmentId(
      (task as { departmentId?: string | null } | undefined)?.departmentId ?? ""
    );
  }, [open, task, projectId, projectChoices, initialSection]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    if (!chosenProjectId) {
      toast.error("Choose a project for this task.");
      return;
    }
    if (!title.trim()) {
      toast.error("Task title is required.");
      return;
    }

    setLoading(true);

    const payload = {
      projectId: chosenProjectId,
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      section: section.trim() || null,
      dueDate: dateInputToIso(dueDate),
      assigneeId: assigneeId || null,
      // V0.5: owner department + cross-department assignment
      departmentId: departmentId || null,
    };

    const url = mode === "create" ? "/api/tasks" : `/api/tasks/${task?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";

    // In edit mode, PATCH expects only the fields. We always send the full
    // shape; the API ignores unchanged keys.
    const body = mode === "create" ? payload : { ...payload };
    // PATCH doesn't accept projectId (immutable in V0.1).
    if (mode === "edit") {
      delete (body as { projectId?: string }).projectId;
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to save task.");
      return;
    }

    toast.success(mode === "create" ? "Task created." : "Task saved.");
    onOpenChange(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!task?.id) return;
    setDeletePending(true);
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    setDeletePending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to delete task.");
      return;
    }
    toast.success("Task deleted.");
    setDeleteOpen(false);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle>
              {mode === "create" ? "New Task" : "Edit Task"}
            </SheetTitle>
            <SheetDescription>
              {mode === "create"
                ? "Add a task to one of your productions."
                : "Update this task's details."}
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleSubmit}
            className="flex-1 flex flex-col gap-4 px-4 overflow-y-auto"
          >
            {readOnly && (
              <div className="rounded-lg bg-amber-400/10 border border-amber-400/25 text-amber-200 text-xs px-3 py-2">
                View-only — this task is outside your edit scope.
              </div>
            )}
            {mode === "create" && projectChoices && projectChoices.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="task-project">Project</Label>
                <Select
                  value={chosenProjectId}
                  onValueChange={setChosenProjectId}
                >
                  <SelectTrigger id="task-project">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectChoices.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                placeholder="What needs to happen?"
                maxLength={300}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Optional context for this task."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="task-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as TaskStatus)}
                >
                  <SelectTrigger id="task-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TaskPriority)}
                >
                  <SelectTrigger id="task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_PRIORITY.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="task-due">Due date</Label>
                <Input
                  id="task-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-department">Owner department</Label>
                <Select
                  value={departmentId || "none"}
                  onValueChange={(v) => {
                    const next = v === "none" ? "" : v;
                    setDepartmentId(next);
                    // If the current assignee isn't in the new department,
                    // clear it so the picker stays consistent.
                    if (next && assigneeId) {
                      const m = memberOptions.find(
                        (mm) => mm.id === assigneeId
                      );
                      if (m && !m.departmentIds.includes(next)) {
                        setAssigneeId("");
                      }
                    }
                  }}
                >
                  <SelectTrigger id="task-department">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No owner department</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select
                value={assigneeId || "unassigned"}
                onValueChange={(v) =>
                  setAssigneeId(v === "unassigned" ? "" : v)
                }
              >
                <SelectTrigger id="task-assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {memberOptions
                    .filter(
                      (m) =>
                        !departmentId ||
                        m.id === currentUser.id ||
                        m.departmentIds.includes(departmentId)
                    )
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                        {m.id === currentUser.id ? " (me)" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {departmentId
                  ? "Showing members of the owner department first."
                  : "Pick an owner department to narrow assignees, or leave it for project-wide."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-section">Section</Label>
              <Input
                id="task-section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="Optional workspace section (e.g. director_notes)"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                Section lets a task live inside a workspace surface. Leave
                blank for a general task on this project.
              </p>
            </div>

            {/* V0.6.1 — comment thread (edit mode only; needs a saved task). */}
            {mode === "edit" && task?.id && (
              <div className="pt-2">
                <CommentThread
                  targetType="task"
                  targetId={task.id}
                  currentUser={currentUser}
                />
              </div>
            )}
          </form>

          <SheetFooter className="border-t flex-row justify-between">
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={loading || readOnly}
              >
                {loading
                  ? "Saving..."
                  : readOnly
                    ? "View only"
                    : mode === "create"
                      ? "Create Task"
                      : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
            {mode === "edit" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDeleteOpen(true)}
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the task. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deletePending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletePending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
