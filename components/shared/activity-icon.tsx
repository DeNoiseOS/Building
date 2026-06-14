import {
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Trash2,
  StickyNote,
  Image as ImageIcon,
  Circle,
  UserPlus,
  UserMinus,
  UserCheck,
  UserCog,
} from "lucide-react";

export function ActivityIcon({ type }: { type: string }) {
  const className = "h-3.5 w-3.5";

  switch (type) {
    case "project_created":
      return <Plus className={className} />;
    case "project_updated":
      return <Pencil className={className} />;
    case "project_archived":
      return <Archive className={className} />;
    case "project_unarchived":
      return <ArchiveRestore className={className} />;
    case "task_completed":
      return <CheckCircle2 className={className} />;
    case "task_created":
    case "task_updated":
      return <Pencil className={className} />;
    case "task_deleted":
      return <Trash2 className={className} />;
    case "note_created":
    case "note_updated":
    case "note_deleted":
      return <StickyNote className={className} />;
    case "reference_created":
    case "reference_updated":
    case "reference_deleted":
      return <ImageIcon className={className} />;
    case "member_invited":
      return <UserPlus className={className} />;
    case "member_joined":
      return <UserCheck className={className} />;
    case "member_removed":
    case "invitation_revoked":
    case "invitation_declined":
      return <UserMinus className={className} />;
    case "member_role_changed":
      return <UserCog className={className} />;
    default:
      return <Circle className={className} />;
  }
}
