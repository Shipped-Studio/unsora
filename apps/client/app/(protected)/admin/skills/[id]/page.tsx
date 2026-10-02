"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowsClockwise,
  FileArrowUp,
  FolderSimple,
  GithubLogo,
  Trash,
  UploadSimple,
} from "@phosphor-icons/react";
import { AdminPage } from "@/components/admin/admin-page";
import { PageSection } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/states";
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminSkill,
  useAdminSkillMutations,
  useSkillFileUpload,
  type AdminSkill,
  type AdminSkillMedia,
  type AdminSkillStep,
} from "@/hooks/admin/use-admin-skills";

const SKILLS_CRUMB = [{ label: "Skills", href: "/admin/skills" }];

const ASPECT_ITEMS = [
  { value: "9/16", label: "9:16" },
  { value: "1/1", label: "1:1" },
  { value: "16/9", label: "16:9" },
];

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

/** One-string-per-line textarea for the string[] fields. */
function LinesField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        rows={4}
        value={value.join("\n")}
        onChange={(e) =>
          onChange(e.target.value.split("\n").filter((l) => l.trim() !== ""))
        }
      />
      {hint ? <FieldDescription>{hint}</FieldDescription> : null}
    </Field>
  );
}

export default function AdminSkillEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: skill, isLoading, error, refetch } = useAdminSkill(id);

  if (error && !skill) {
    return (
      <AdminPage title="Skill" parents={SKILLS_CRUMB}>
        <ErrorState
          title="Couldn't load this skill"
          description={error.message}
          onRetry={() => void refetch()}
        />
      </AdminPage>
    );
  }

  if (isLoading || !skill) {
    return (
      <AdminPage title="Skill" parents={SKILLS_CRUMB}>
        <div className="space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </AdminPage>
    );
  }

  return <SkillEditor id={id} skill={skill} />;
}

function SkillEditor({ id, skill }: { id: string; skill: AdminSkill }) {
  const router = useRouter();
  const { update, remove, resync, removeFile } = useAdminSkillMutations(id);
  const { uploadSkillFiles, uploadMedia } = useSkillFileUpload(id);

  // Seeded from the loaded skill; the editor owns it after the first edit.
  const [draft, setDraft] = useState<Draft>(() => toDraft(skill));
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const isPublished = skill.status === "PUBLISHED";

  const save = (extra?: Partial<AdminSkill>) => {
    update.mutate(
      { ...draft, ...extra },
      {
        onSuccess: () =>
          toast.success(
            extra?.status === "PUBLISHED"
              ? "Skill published"
              : extra?.status === "DRAFT"
                ? "Skill unpublished"
                : "Skill saved",
          ),
        onError: (e) => toast.error("Couldn't save the skill", { description: e.message }),
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
      toast.success(`Uploaded ${files.length} ${files.length === 1 ? "file" : "files"}`);
    } catch (e) {
      toast.error("Couldn't upload the files", {
        description: e instanceof Error ? e.message : undefined,
      });
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
      toast.error("Couldn't upload the media", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const setStep = (i: number, patch: Partial<AdminSkillStep>) =>
    set(
      "steps",
      draft.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    );

  return (
    <AdminPage
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{skill.name}</span>
          <Badge variant={isPublished ? "secondary" : "outline"}>
            {isPublished ? "Published" : "Draft"}
          </Badge>
        </span>
      }
      parents={SKILLS_CRUMB}
      actions={
        <>
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Delete skill" />
              }
            >
              <Trash />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {skill.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Removes the skill page, its uploaded files and media. This
                  can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate(skill.id, {
                      onSuccess: () => {
                        toast.success("Skill deleted");
                        router.push("/admin/skills");
                      },
                      onError: (e) =>
                        toast.error("Couldn't delete the skill", {
                          description: e.message,
                        }),
                    })
                  }
                >
                  {remove.isPending ? <Spinner data-icon="inline-start" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            variant="outline"
            onClick={() => save({ status: isPublished ? "DRAFT" : "PUBLISHED" })}
            disabled={update.isPending}
          >
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
          <Button onClick={() => save()} disabled={update.isPending}>
            {update.isPending ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-8">
        <PageSection title="Basics">
          <Card size="sm">
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="skill-name">Name</FieldLabel>
                <Input
                  id="skill-name"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="skill-slug">Slug</FieldLabel>
                <Input
                  id="skill-slug"
                  value={draft.slug}
                  onChange={(e) => set("slug", e.target.value)}
                />
                <FieldDescription>tryunsora.com/skills/{draft.slug}</FieldDescription>
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="skill-tagline">Tagline</FieldLabel>
                <Input
                  id="skill-tagline"
                  value={draft.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                  placeholder="Creator-style spots from a brief"
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="skill-description">Description</FieldLabel>
                <Textarea
                  id="skill-description"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>
        </PageSection>

        <PageSection
          title="Source"
          description="Where the skill's files come from: a GitHub repo, files uploaded here, or both."
          actions={
            skill.githubUrl ? (
              <Button
                variant="outline"
                onClick={() =>
                  resync.mutate(undefined, {
                    onSuccess: () => toast.success("Re-synced from GitHub"),
                    onError: (e) =>
                      toast.error("Couldn't re-sync from GitHub", {
                        description: e.message,
                      }),
                  })
                }
                disabled={resync.isPending}
              >
                {resync.isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <ArrowsClockwise data-icon="inline-start" />
                )}
                Re-sync
              </Button>
            ) : undefined
          }
        >
          <Card size="sm">
            <CardContent className="gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="skill-github">
                    <GithubLogo className="size-4" /> GitHub URL
                  </FieldLabel>
                  <Input
                    id="skill-github"
                    value={draft.githubUrl ?? ""}
                    onChange={(e) => set("githubUrl", e.target.value)}
                    placeholder="https://github.com/owner/skill-repo"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="skill-install">Install command</FieldLabel>
                  <Input
                    id="skill-install"
                    value={draft.installCommand ?? ""}
                    onChange={(e) => set("installCommand", e.target.value)}
                    placeholder="curl -O https://example.com/SKILL.md"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => filesInputRef.current?.click()}
                  disabled={uploadingFiles}
                >
                  {uploadingFiles ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <FileArrowUp data-icon="inline-start" />
                  )}
                  Upload files
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={uploadingFiles}
                >
                  <FolderSimple data-icon="inline-start" />
                  Upload skill folder
                </Button>
                <span className="text-xs text-muted-foreground">
                  Include a SKILL.md. It becomes the canonical skill file.
                </span>
                <input
                  ref={filesInputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    void handleFilePick(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={folderInputRef}
                  type="file"
                  hidden
                  // @ts-expect-error: non-standard folder-picker attribute
                  webkitdirectory=""
                  onChange={(e) => {
                    void handleFilePick(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {skill.files.length > 0 ? (
                <ul className="divide-y divide-card rounded-xl bg-muted text-sm">
                  {skill.files.map((f, i) => (
                    <li
                      key={`${f.path}-${i}`}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono text-xs">
                          {f.relativePath}
                        </span>
                        {skill.skillMdPath === f.path ? (
                          <Badge variant="secondary">SKILL.md</Badge>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className={buttonVariants({ variant: "ghost", size: "xs" })}
                        >
                          View
                        </a>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Delete ${f.relativePath}`}
                          className="text-destructive"
                          disabled={removeFile.isPending}
                          onClick={() =>
                            removeFile.mutate(f.path, {
                              onSuccess: () => toast.success("File deleted"),
                              onError: (e) =>
                                toast.error("Couldn't delete the file", {
                                  description: e.message,
                                }),
                            })
                          }
                        >
                          <Trash />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </PageSection>

        <PageSection
          title="Showcase media"
          description="Images and videos shown on the skill page."
          actions={
            <Button
              variant="outline"
              onClick={() => mediaInputRef.current?.click()}
              disabled={uploadingMedia}
            >
              {uploadingMedia ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UploadSimple data-icon="inline-start" />
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
              void handleMediaPick(e.target.files);
              e.target.value = "";
            }}
          />
          {skill.media.length === 0 ? (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              No media yet. Upload vertical (9:16) clips or images.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {skill.media.map((m) => (
                <MediaCard key={m.id} skillId={id} media={m} />
              ))}
            </div>
          )}
        </PageSection>

        <PageSection title="Page content" description="The copy on the landing page.">
          <Card size="sm">
            <CardContent className="gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <LinesField
                  id="skill-highlights"
                  label="Highlights"
                  hint="One per line, shown as feature chips."
                  value={draft.highlights}
                  onChange={(v) => set("highlights", v)}
                />
                <LinesField
                  id="skill-examples"
                  label="Example prompts"
                  hint="One per line."
                  value={draft.examples}
                  onChange={(v) => set("examples", v)}
                />
                <LinesField
                  id="skill-requirements"
                  label="Requirements"
                  hint="One per line."
                  value={draft.requirements}
                  onChange={(v) => set("requirements", v)}
                />
                <div className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="skill-cta-headline">CTA headline</FieldLabel>
                    <Input
                      id="skill-cta-headline"
                      value={draft.ctaHeadline}
                      onChange={(e) => set("ctaHeadline", e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="skill-cta-body">CTA body</FieldLabel>
                    <Input
                      id="skill-cta-body"
                      value={draft.ctaBody}
                      onChange={(e) => set("ctaBody", e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="skill-sort">Sort order</FieldLabel>
                    <Input
                      id="skill-sort"
                      type="number"
                      value={draft.sortOrder}
                      onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
                    />
                  </Field>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Steps</span>
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
                    className="grid gap-2 rounded-lg bg-muted p-3 sm:grid-cols-[70px_1fr_auto]"
                  >
                    <Input
                      aria-label={`Step ${i + 1} number`}
                      value={step.num}
                      onChange={(e) => setStep(i, { num: e.target.value })}
                      placeholder="01"
                    />
                    <div className="space-y-2">
                      <Input
                        aria-label={`Step ${i + 1} title`}
                        value={step.title}
                        onChange={(e) => setStep(i, { title: e.target.value })}
                        placeholder="Step title"
                      />
                      <Textarea
                        aria-label={`Step ${i + 1} description`}
                        rows={2}
                        value={step.body}
                        onChange={(e) => setStep(i, { body: e.target.value })}
                        placeholder="Step description"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove step ${i + 1}`}
                      onClick={() =>
                        set(
                          "steps",
                          draft.steps.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <Trash />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </PageSection>
      </div>
    </AdminPage>
  );
}

function MediaCard({
  skillId,
  media,
}: {
  skillId: string;
  media: AdminSkillMedia;
}) {
  const { updateMedia, removeMedia } = useAdminSkillMutations(skillId);
  const [label, setLabel] = useState(media.label);

  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <div className="relative aspect-9/16 bg-muted">
        {media.type === "VIDEO" ? (
          <video
            src={media.url}
            muted
            loop
            playsInline
            className="size-full object-cover"
            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => e.currentTarget.pause()}
          />
        ) : (
          <img src={media.url} alt={media.label} className="size-full object-cover" />
        )}
        <Button
          variant="secondary"
          size="icon-xs"
          aria-label="Remove media"
          className="absolute top-1.5 right-1.5 text-destructive"
          disabled={removeMedia.isPending}
          onClick={() =>
            removeMedia.mutate(media.id, {
              onError: (e) =>
                toast.error("Couldn't remove the media", { description: e.message }),
            })
          }
        >
          <Trash />
        </Button>
      </div>
      <div className="space-y-1.5 p-2">
        <Input
          className="h-8 text-xs"
          aria-label="Media label"
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
          items={ASPECT_ITEMS}
          onValueChange={(aspect) =>
            aspect && updateMedia.mutate({ mediaId: media.id, aspect: aspect as string })
          }
        >
          <SelectTrigger size="sm" className="w-full text-xs" aria-label="Aspect ratio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASPECT_ITEMS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
