"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Mail,
  ListTodo,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  UserPlus,
  ShieldCheck,
  AtSign,
  Megaphone,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

export interface NotificationInvitation {
  id: string;
  projectId: string;
  projectName: string;
  role: string;
  invitedBy: string;
  createdAt: string;
}

export interface NotificationTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  dueDate: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationData {
  invitations: NotificationInvitation[];
  tasks: NotificationTask[];
  /** Total open assigned tasks (may exceed tasks.length when truncated). */
  totalAssignedOpen: number;
  /** Total pending invitations (may exceed invitations.length when truncated). */
  totalInvitations: number;
  /** V0.5 — workflow notifications (deliveries from `lib/notifications`). */
  items: NotificationItem[];
  /** Number of unread items in `items`. */
  unreadCount: number;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.round(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const TYPE_LABEL: Record<string, string> = {
  invitation_received: "Invitations",
  invitation_accepted: "Invitation responses",
  task_assigned: "Tasks assigned to you",
  task_reassigned: "Tasks reassigned",
  task_waiting_approval: "Awaiting approval",
  task_approved: "Approvals",
  task_rejected: "Sent back",
  department_member_added: "Department changes",
  budget_request_submitted: "Budget submitted",
  budget_request_approved: "Budget approved",
  budget_request_rejected: "Budget rejected",
  budget_request_purchased: "Budget purchased",
  purchase_request_submitted: "Purchase submitted",
  purchase_request_approved: "Purchase approved",
  purchase_request_rejected: "Purchase rejected",
  purchase_completed: "Purchase completed",
  budget_allocated: "Allocation received",
  budget_allocation_accepted: "Allocation accepted",
  budget_allocation_rejected: "Allocation rejected",
  budget_revision_requested: "Revision requested",
  budget_revision_resolved: "Revision resolved",
  comment_created: "Comments",
  // V0.7 — communication
  mention_task: "Mentions",
  mention_budget: "Mentions",
  mention_note: "Mentions",
  mention_reference: "Mentions",
  mention_announcement: "Mentions",
  mention_discussion: "Mentions",
  announcement_created: "Announcements",
  discussion_created: "Discussion replies",
  discussion_reply: "Discussion replies",
  // V0.9 / V0.10
  custody_issued: "Custody",
  custody_settlement_requested: "Custody",
  custody_settlement_approved: "Custody",
  equipment_assigned: "Equipment",
  equipment_returned: "Equipment",
  damage_report_created: "Damage reports",
  damage_report_resolved: "Damage reports",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  invitation_received: <Mail className="h-3.5 w-3.5" />,
  invitation_accepted: <CheckCircle2 className="h-3.5 w-3.5" />,
  task_assigned: <ListTodo className="h-3.5 w-3.5" />,
  task_reassigned: <ListTodo className="h-3.5 w-3.5" />,
  task_waiting_approval: <ShieldCheck className="h-3.5 w-3.5" />,
  task_approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  task_rejected: <XCircle className="h-3.5 w-3.5" />,
  department_member_added: <UserPlus className="h-3.5 w-3.5" />,
  budget_request_submitted: <ShieldCheck className="h-3.5 w-3.5" />,
  budget_request_approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  budget_request_rejected: <XCircle className="h-3.5 w-3.5" />,
  budget_request_purchased: <CheckCircle2 className="h-3.5 w-3.5" />,
  // V0.7
  mention_task: <AtSign className="h-3.5 w-3.5" />,
  mention_budget: <AtSign className="h-3.5 w-3.5" />,
  mention_note: <AtSign className="h-3.5 w-3.5" />,
  mention_reference: <AtSign className="h-3.5 w-3.5" />,
  mention_announcement: <AtSign className="h-3.5 w-3.5" />,
  mention_discussion: <AtSign className="h-3.5 w-3.5" />,
  announcement_created: <Megaphone className="h-3.5 w-3.5" />,
  discussion_created: <MessageCircle className="h-3.5 w-3.5" />,
  discussion_reply: <MessageCircle className="h-3.5 w-3.5" />,
};

export function NotificationMenu({ data }: { data: NotificationData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // V0.5 — total = unread notifications + pending invitations.
  // Tasks-assigned count is kept inside the dropdown for context but doesn't
  // contribute to the bell badge (only "things you haven't seen" count).
  const total = data.unreadCount + data.totalInvitations;
  const display = useMemo(() => (total > 99 ? "99+" : String(total)), [total]);

  // Group workflow notifications by type for display.
  const grouped = useMemo(() => {
    const map = new Map<string, NotificationData["items"]>();
    for (const item of data.items) {
      if (!map.has(item.type)) map.set(item.type, []);
      map.get(item.type)!.push(item);
    }
    return Array.from(map.entries());
  }, [data.items]);

  function markAllRead() {
    startTransition(async () => {
      await fetch("/api/notifications", { method: "POST" });
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-lg hover:bg-white/[0.05]"
          aria-label={`Notifications${total > 0 ? ` (${total})` : ""}`}
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {total > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-[10px] font-semibold text-white flex items-center justify-center tabular-nums shadow-soft"
              aria-hidden="true"
            >
              {display}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[360px] p-0 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {data.unreadCount > 0
                ? `${data.unreadCount} unread`
                : "All caught up."}
            </p>
          </div>
          {data.unreadCount > 0 && (
            <button
              onClick={markAllRead}
              disabled={pending}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* V0.5 workflow notifications, grouped by type. */}
        {grouped.length > 0 && (
          <div className="max-h-[280px] overflow-y-auto">
            {grouped.map(([type, items]) => (
              <Section
                key={type}
                title={TYPE_LABEL[type] ?? type}
                icon={TYPE_ICON[type] ?? <Bell className="h-3.5 w-3.5" />}
                count={items.filter((i) => !i.readAt).length}
                viewAllHref={items[0]?.link ?? "/inbox"}
                viewAllLabel="View"
              >
                {items.slice(0, 4).map((item) => (
                  <Link
                    key={item.id}
                    href={item.link ?? "#"}
                    className={cn(
                      "flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors",
                      !item.readAt && "bg-primary/[0.04]"
                    )}
                  >
                    <div className="h-7 w-7 mt-0.5 rounded-lg bg-muted/40 border border-white/[0.05] flex items-center justify-center text-muted-foreground shrink-0">
                      {TYPE_ICON[type] ?? <Bell className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.title}
                      </p>
                      {item.body && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {item.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {relativeTime(item.createdAt)}
                      </p>
                    </div>
                  </Link>
                ))}
              </Section>
            ))}
          </div>
        )}

        {/* Invitations */}
        <Section
          title="Pending invitations"
          icon={<Mail className="h-3.5 w-3.5" />}
          count={data.totalInvitations}
          viewAllHref="/inbox"
          viewAllLabel="Open Inbox"
        >
          {data.invitations.length === 0 ? (
            <EmptyRow label="No pending invitations." />
          ) : (
            data.invitations.map((inv) => (
              <Link
                key={inv.id}
                href="/inbox"
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {inv.projectName}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {ROLE_LABELS[inv.role] ?? inv.role} · invited by{" "}
                    {inv.invitedBy} · {relativeTime(inv.createdAt)}
                  </p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            ))
          )}
        </Section>

        {/* Assigned tasks */}
        <Section
          title="Tasks assigned to me"
          icon={<ListTodo className="h-3.5 w-3.5" />}
          count={data.totalAssignedOpen}
          viewAllHref="/tasks?mine=1"
          viewAllLabel="My Tasks"
          divider
        >
          {data.tasks.length === 0 ? (
            <EmptyRow label="Nothing assigned to you right now." />
          ) : (
            data.tasks.map((task) => (
              <Link
                key={task.id}
                href={`/projects/${task.projectId}/tasks`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-muted/40 border border-white/[0.05] flex items-center justify-center text-muted-foreground shrink-0">
                  <ListTodo className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {task.projectName}
                    {task.dueDate ? ` · due ${relativeTime(task.dueDate)}` : ""}
                  </p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            ))
          )}
        </Section>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Section({
  title,
  icon,
  count,
  viewAllHref,
  viewAllLabel,
  divider,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  viewAllHref: string;
  viewAllLabel: string;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(divider && "border-t border-white/[0.05]")}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">
            {title}
          </span>
          {count > 0 && (
            <span className="text-[10px] tabular-nums text-muted-foreground/80">
              ({count})
            </span>
          )}
        </div>
        <Link
          href={viewAllHref}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {viewAllLabel}
        </Link>
      </div>
      <div className="pb-1">{children}</div>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="px-4 py-3 text-[12px] text-muted-foreground">{label}</div>
  );
}
