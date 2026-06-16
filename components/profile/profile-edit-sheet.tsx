"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";
import { GroupedRolePicker } from "@/components/shared/grouped-role-picker";
import {
  EXPERIENCE_LEVELS,
  COMMON_LANGUAGES,
} from "@/lib/profile-completion";
import { ROLE_LABELS } from "@/lib/roles";

export interface ProfileShape {
  name: string;
  profileImage: string | null;
  primaryRole: string | null;
  additionalRoles: string[];
  experienceLevel: string | null;
  location: string | null;
  languages: string[];
  contactPhone: string | null;
  contactWebsite: string | null;
  portfolioLinks: { title: string; url: string }[];
}

interface Props {
  profile: ProfileShape;
  trigger: React.ReactNode;
}

export function ProfileEditSheet({ profile, trigger }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(profile.name);
  const [profileImage, setProfileImage] = useState(profile.profileImage ?? "");
  const [primaryRole, setPrimaryRole] = useState(profile.primaryRole ?? "");
  const [additionalRoles, setAdditionalRoles] = useState<string[]>(
    profile.additionalRoles
  );
  const [experienceLevel, setExperienceLevel] = useState(
    profile.experienceLevel ?? ""
  );
  const [location, setLocation] = useState(profile.location ?? "");
  const [languages, setLanguages] = useState<string[]>(profile.languages);
  const [contactPhone, setContactPhone] = useState(profile.contactPhone ?? "");
  const [contactWebsite, setContactWebsite] = useState(
    profile.contactWebsite ?? ""
  );
  const [portfolio, setPortfolio] = useState<{ title: string; url: string }[]>(
    profile.portfolioLinks
  );
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  function toggleAdditionalRole(role: string) {
    setAdditionalRoles((cur) =>
      cur.includes(role) ? cur.filter((r) => r !== role) : [...cur, role]
    );
  }

  function toggleLanguage(code: string) {
    setLanguages((cur) =>
      cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]
    );
  }

  function addPortfolioLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    try {
      new URL(linkUrl.trim());
    } catch {
      toast.error("Portfolio URL is not a valid URL.");
      return;
    }
    setPortfolio((cur) => [
      ...cur,
      { title: linkTitle.trim(), url: linkUrl.trim() },
    ]);
    setLinkTitle("");
    setLinkUrl("");
  }

  function removePortfolioLink(idx: number) {
    setPortfolio((cur) => cur.filter((_, i) => i !== idx));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          profileImage: profileImage || null,
          primaryRole: primaryRole || null,
          additionalRoles,
          experienceLevel: experienceLevel || null,
          location: location || null,
          languages,
          contactPhone: contactPhone || null,
          contactWebsite: contactWebsite || null,
          portfolioLinks: portfolio,
          // Clear the skip flag on save so the user gets credit.
          profileSkippedAt: null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update profile.");
        return;
      }
      toast.success("Profile updated.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <form onSubmit={save} className="flex h-full flex-col">
          <SheetHeader>
            <SheetTitle>Edit profile</SheetTitle>
            <SheetDescription>
              Your professional identity. Fields here power crew search and
              project invitations.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="p-name">Name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-image">Profile picture URL</Label>
              <Input
                id="p-image"
                type="url"
                value={profileImage}
                onChange={(e) => setProfileImage(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="space-y-2">
              <Label>Primary role</Label>
              <GroupedRolePicker
                value={primaryRole}
                onChange={setPrimaryRole}
              />
            </div>

            <div className="space-y-2">
              <Label>Additional roles</Label>
              <p className="text-xs text-muted-foreground">
                Roles you can also play. Click to toggle.
              </p>
              <div className="flex flex-wrap gap-2">
                {additionalRoles.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    None selected.
                  </span>
                )}
                {additionalRoles.map((r) => (
                  <Badge
                    key={r}
                    variant="outline"
                    className="bg-primary/10 border-primary/30 cursor-pointer"
                    onClick={() => toggleAdditionalRole(r)}
                  >
                    {ROLE_LABELS[r] ?? r} <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
              </div>
              <GroupedRolePicker
                value=""
                onChange={toggleAdditionalRole}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-exp">Experience level</Label>
              <Select
                value={experienceLevel}
                onValueChange={setExperienceLevel}
              >
                <SelectTrigger id="p-exp">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIENCE_LEVELS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-loc">Location</Label>
              <Input
                id="p-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Riyadh, SA"
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label>Languages</Label>
              <div className="flex flex-wrap gap-2">
                {COMMON_LANGUAGES.map((l) => {
                  const on = languages.includes(l.value);
                  return (
                    <Badge
                      key={l.value}
                      variant="outline"
                      onClick={() => toggleLanguage(l.value)}
                      className={
                        on
                          ? "bg-primary/15 border-primary/40 cursor-pointer"
                          : "cursor-pointer hover:bg-white/[0.04]"
                      }
                    >
                      {l.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-phone">Phone</Label>
                <Input
                  id="p-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+966…"
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-web">Website</Label>
                <Input
                  id="p-web"
                  type="url"
                  value={contactWebsite}
                  onChange={(e) => setContactWebsite(e.target.value)}
                  placeholder="https://…"
                  maxLength={500}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Portfolio links</Label>
              <div className="space-y-2">
                {portfolio.map((l, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{l.title}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {l.url}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePortfolioLink(i)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Title"
                  maxLength={120}
                />
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="col-span-2"
                  type="url"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPortfolioLink}
              >
                Add link
              </Button>
            </div>
          </div>

          <SheetFooter className="border-t">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save profile"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
