"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GithubLogo, Plus, PuzzlePiece, UploadSimple } from "@phosphor-icons/react";
import { AdminPage } from "@/components/admin/admin-page";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  useAdminSkillMutations,
  useAdminSkills,
} from "@/hooks/admin/use-admin-skills";
import { timeAgo } from "@/lib/admin-format";

export default function AdminSkillsPage() {
  const router = useRouter();
  const { data: skills, isLoading, error, refetch } = useAdminSkills();
  const { importGithub, create } = useAdminSkillMutations();

  const [importOpen, setImportOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleImport = (event: React.FormEvent) => {
    event.preventDefault();
    if (!githubUrl) return;
    importGithub.mutate(githubUrl, {
      onSuccess: (skill) => {
        toast.success(`Imported ${skill.name}`);
        setImportOpen(false);
        setGithubUrl("");
        router.push(`/admin/skills/${skill.id}`);
      },
      onError: (e) =>
        toast.error("Couldn't import the skill", { description: e.message }),
    });
  };

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName) return;
    create.mutate(
      { name: newName, sourceType: "UPLOAD" },
      {
        onSuccess: (skill) => {
          setCreateOpen(false);
          setNewName("");
          router.push(`/admin/skills/${skill.id}`);
        },
        onError: (e) =>
          toast.error("Couldn't create the skill", { description: e.message }),
      },
    );
  };

  return (
    <AdminPage
      title="Skills"
      description="Agent skills shown on the landing site"
      actions={
        <>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <GithubLogo data-icon="inline-start" />
            Import from GitHub
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            New skill
          </Button>
        </>
      }
    >
      {error && !skills ? (
        <ErrorState
          title="Couldn't load skills"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <div className="overflow-hidden rounded-xl bg-muted">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
          ))}
        </div>
      ) : !skills?.length ? (
        <EmptyState
          icon={PuzzlePiece}
          title="No skills yet"
          description="Import one from GitHub or create a draft and upload its files."
          action={{ label: "New skill", onClick: () => setCreateOpen(true) }}
          secondaryAction={{
            label: "Import from GitHub",
            onClick: () => setImportOpen(true),
          }}
        />
      ) : (
        <ul className="overflow-hidden rounded-xl bg-muted">
          {skills.map((skill) => (
            <li key={skill.id} className="border-b last:border-b-0">
              <Link
                href={`/admin/skills/${skill.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{skill.name}</span>
                    <Badge variant={skill.status === "PUBLISHED" ? "secondary" : "outline"}>
                      {skill.status === "PUBLISHED" ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    /skills/{skill.slug}
                    {skill.tagline ? ` · ${skill.tagline}` : ""}
                  </div>
                </div>
                <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
                  <span className="inline-flex items-center gap-1">
                    {skill.sourceType === "GITHUB" ? (
                      <GithubLogo className="size-3.5" />
                    ) : (
                      <UploadSimple className="size-3.5" />
                    )}
                    {skill.sourceType === "GITHUB" ? "GitHub" : "Upload"}
                  </span>
                  <span className="tabular-nums">{skill._count.media} media</span>
                  <span className="tabular-nums">{timeAgo(skill.updatedAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <form onSubmit={handleImport} className="grid gap-6">
            <DialogHeader>
              <DialogTitle>Import skill from GitHub</DialogTitle>
              <DialogDescription>
                Paste a repo URL that contains a SKILL.md. The name and
                description come from its frontmatter and a draft is created.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="github-url">Repository URL</FieldLabel>
              <Input
                id="github-url"
                placeholder="https://github.com/owner/skill-repo"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={!githubUrl || importGithub.isPending}>
                {importGithub.isPending ? <Spinner data-icon="inline-start" /> : null}
                Import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate} className="grid gap-6">
            <DialogHeader>
              <DialogTitle>New skill</DialogTitle>
              <DialogDescription>
                Creates an empty draft. Upload the skill files and write the
                page content in the editor.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="skill-name">Name</FieldLabel>
              <Input
                id="skill-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={!newName || create.isPending}>
                {create.isPending ? <Spinner data-icon="inline-start" /> : null}
                Create draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
