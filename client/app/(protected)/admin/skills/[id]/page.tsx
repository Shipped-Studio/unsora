"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowsClockwise,
  FileArrowUp,
  GithubLogo,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  useAdminSkill,
  useAdminSkillMutations,
  useSkillFileUpload,
  type AdminSkill,
  type AdminSkillStep,
} from "@/hooks/admin/use-admin-skills";

/** One-string-per-line textarea editor for the string[] fields. */
function LinesField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <Textarea
        rows={4}
        value={value.join("\n")}
        onChange={(e) =>
          onChange(e.target.value.split("\n").filter((l) => l.trim() !== ""))
        }
      />
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

type Draft = Pick<
  AdminSkill,
  | "name"
  | "slug"
  | "tagline"
  | "description"
  | "githubUrl"
  | "installCommand"
  | "highlights"
  | "steps"
  | "examples"
  | "requirements"
  | "ctaHeadline"
  | "ctaBody"
  | "sortOrder"
>;

const toDraft = (s: AdminSkill): Draft => ({
  name: s.name,
  slug: s.slug,
  tagline: s.tagline,
  description: s.description,
  githubUrl: s.githubUrl,
  installCommand: s.installCommand,
  highlights: s.highlights,
  steps: s.steps,
  examples: s.examples,
  requirements: s.requirements,
  ctaHeadline: s.ctaHeadline,
  ctaBody: s.ctaBody,
  sortOrder: s.sortOrder,
});

export default function AdminSkillEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: skill, isLoading } = useAdminSkill(id);
  const { update, remove, resync, removeFile } = useAdminSkillMutations(id);
  const { uploadSkillFiles, uploadMedia } = useSkillFileUpload(id);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (skill && !draft) setDraft(toDraft(skill));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill]);

  if (isLoading || !skill || !draft) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const save = (extra?: Partial<AdminSkill>) => {
    update.mutate(
      { ...draft, ...extra },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e) => toast.error(e.message),
      },
    );
  };

  const handleFilePick = async (list: FileList | null) => {
    if (!list?.length) return;
    const files = Array.from(list).map((file) => ({
      file,
      relativePath:
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        file.name,
    }));
    setUploadingFiles(true);
    try {
      await uploadSkillFiles(files);
      toast.success(`Uploaded ${files.length} file${files.length > 1 ? "s" : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleMediaPick = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploadingMedia(true);
    try {
      for (const file of Array.from(list)) {
        await uploadMedia(file);
      }
      toast.success("Media uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingMedia(false);
    }
  };

  const setStep = (i: number, patch: Partial<AdminSkillStep>) => {
    const steps = draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s));
    set("steps", steps);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/skills"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Skills
          </Link>
          <h1 className="text-lg font-semibold text-foreground">
            {skill.name}
          </h1>
          <Badge
            variant={skill.status === "PUBLISHED" ? "default" : "secondary"}
          >
            {skill.status === "PUBLISHED" ? "Published" : "Draft"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger
              aria-label="Delete skill"
              className="inline-flex size-9 items-center justify-center rounded-lg transition-colors hover:bg-destructive/10"
            >
              <Trash className="size-4 text-destructive" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{skill.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Removes the skill page, its uploaded files and media. This
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    remove.mutate(skill.id, {
                      onSuccess: () => {
                        toast.success("Skill deleted");
                        router.push("/admin/skills");
                      },
                      onError: (e) => toast.error(e.message),
                    })
                  }
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            onClick={() =>
              save({
                status: skill.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
              })
            }
            disabled={update.isPending}
          >
            {skill.status === "PUBLISHED" ? "Unpublish" : "Publish"}
          </Button>
          <Button onClick={() => save()} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <SectionCard title="Basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input
              value={draft.slug}
              onChange={(e) => set("slug", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              tryunsora.com/skills/{draft.slug}
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tagline</Label>
            <Input
              value={draft.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="Creator-style spots from a brief"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Source"
        description="Where the skill's files come from — a GitHub repo, files uploaded here, or both."
        actions={
          skill.githubUrl ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                resync.mutate(undefined, {
                  onSuccess: () => toast.success("Re-synced from GitHub"),
                  onError: (e) => toast.error(e.message),
                })
              }
              disabled={resync.isPending}
            >
              <ArrowsClockwise
                className={resync.isPending ? "size-4 animate-spin" : "size-4"}
              />
              Re-sync
            </Button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="inline-flex items-center gap-1.5">
              <GithubLogo className="size-4" /> GitHub URL
            </Label>
            <Input
              value={draft.githubUrl ?? ""}
              onChange={(e) => set("githubUrl", e.target.value)}
              placeholder="https://github.com/owner/skill-repo"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Install command</Label>
            <Input
              value={draft.installCommand ?? ""}
              onChange={(e) => set("installCommand", e.target.value)}
              placeholder="curl -O https://…/SKILL.md"
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => filesInputRef.current?.click()}
              disabled={uploadingFiles}
            >
              {uploadingFiles ? (
                <Spinner className="size-4" />
              ) : (
                <FileArrowUp className="size-4" />
              )}
              Upload files
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploadingFiles}
            >
              <UploadSimple className="size-4" />
              Upload skill folder
            </Button>
            <span className="text-xs text-muted-foreground">
              Include a SKILL.md — it becomes the canonical skill file.
            </span>
            <input
              ref={filesInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                handleFilePick(e.target.files);
                e.target.value = "";
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              hidden
              // @ts-expect-error — non-standard folder-picker attribute
              webkitdirectory=""
              onChange={(e) => {
                handleFilePick(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {skill.files.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {skill.files.map((f, i) => (
                <li
                  key={`${f.path}-${i}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="truncate font-mono text-xs">
                    {f.relativePath}
                    {skill.skillMdPath === f.path && (
                      <Badge variant="secondary" className="ml-2">
                        SKILL.md
                      </Badge>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      view
                    </a>
                    <button
                      type="button"
                      aria-label={`Delete ${f.relativePath}`}
                      disabled={removeFile.isPending}
                      onClick={() =>
                        removeFile.mutate(f.path, {
                          onSuccess: () => toast.success("File deleted"),
                          onError: (e) => toast.error(e.message),
                        })
                      }
                      className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-destructive/10 disabled:opacity-50"
                    >
                      <Trash className="size-3.5 text-destructive" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Showcase media"
        description="Images and videos shown on the skill page."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => mediaInputRef.current?.click()}
            disabled={uploadingMedia}
          >
            {uploadingMedia ? (
              <Spinner className="size-4" />
            ) : (
              <UploadSimple className="size-4" />
            )}
            Add media
          </Button>
        }
      >
        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => {
            handleMediaPick(e.target.files);
            e.target.value = "";
          }}
        />
        {skill.media.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No media yet — upload vertical (9:16) clips or images.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {skill.media.map((m) => (
              <MediaCard key={m.id} skillId={id} media={m} />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Page content"
        description="The marketing copy on the landing page."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LinesField
            label="Highlights"
            hint="One per line, shown as feature chips."
            value={draft.highlights}
            onChange={(v) => set("highlights", v)}
          />
          <LinesField
            label="Example prompts"
            hint="One per line."
            value={draft.examples}
            onChange={(v) => set("examples", v)}
          />
          <LinesField
            label="Requirements"
            hint="One per line."
            value={draft.requirements}
            onChange={(v) => set("requirements", v)}
          />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>CTA headline</Label>
              <Input
                value={draft.ctaHeadline}
                onChange={(e) => set("ctaHeadline", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CTA body</Label>
              <Input
                value={draft.ctaBody}
                onChange={(e) => set("ctaBody", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={draft.sortOrder}
                onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Steps</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                set("steps", [
                  ...draft.steps,
                  {
                    num: String(draft.steps.length + 1).padStart(2, "0"),
                    title: "",
                    body: "",
                  },
                ])
              }
            >
              Add step
            </Button>
          </div>
          {draft.steps.map((step, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[70px_1fr_auto]"
            >
              <Input
                value={step.num}
                onChange={(e) => setStep(i, { num: e.target.value })}
                placeholder="01"
              />
              <div className="space-y-2">
                <Input
                  value={step.title}
                  onChange={(e) => setStep(i, { title: e.target.value })}
                  placeholder="Step title"
                />
                <Textarea
                  rows={2}
                  value={step.body}
                  onChange={(e) => setStep(i, { body: e.target.value })}
                  placeholder="Step description"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove step"
                onClick={() =>
                  set(
                    "steps",
                    draft.steps.filter((_, j) => j !== i),
                  )
                }
              >
                <Trash className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function MediaCard({
  skillId,
  media,
}: {
  skillId: string;
  media: {
    id: string;
    type: "IMAGE" | "VIDEO";
    url: string;
    label: string;
    aspect: string;
  };
}) {
  const { updateMedia, removeMedia } = useAdminSkillMutations(skillId);
  const [label, setLabel] = useState(media.label);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="relative aspect-9/16 bg-muted">
        {media.type === "VIDEO" ? (
          <video
            src={media.url}
            muted
            loop
            playsInline
            className="h-full w-full object-cover"
            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => e.currentTarget.pause()}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={media.url}
            alt={media.label}
            className="h-full w-full object-cover"
          />
        )}
        <button
          aria-label="Remove media"
          onClick={() => removeMedia.mutate(media.id)}
          className="absolute right-1.5 top-1.5 rounded-md bg-background/80 p-1.5 text-destructive backdrop-blur transition-colors hover:bg-background"
        >
          <Trash className="size-3.5" />
        </button>
      </div>
      <div className="space-y-1.5 p-2">
        <Input
          className="h-8 text-xs"
          value={label}
          placeholder="Label"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() =>
            label !== media.label &&
            updateMedia.mutate({ mediaId: media.id, label })
          }
        />
        <Select
          value={media.aspect}
          onValueChange={(aspect) =>
            aspect && updateMedia.mutate({ mediaId: media.id, aspect })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="9/16">9:16</SelectItem>
            <SelectItem value="1/1">1:1</SelectItem>
            <SelectItem value="16/9">16:9</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
