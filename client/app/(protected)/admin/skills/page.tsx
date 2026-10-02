"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  GithubLogo,
  Plus,
  FilmSlate,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAdminSkills,
  useAdminSkillMutations,
} from "@/hooks/admin/use-admin-skills";
import { timeAgo } from "@/lib/admin-format";

export default function AdminSkillsPage() {
  const router = useRouter();
  const { data: skills, isLoading } = useAdminSkills();
  const { importGithub, create } = useAdminSkillMutations();

  const [importOpen, setImportOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const handleImport = () => {
    importGithub.mutate(githubUrl, {
      onSuccess: (skill) => {
        toast.success(`Imported ${skill.name}`);
        setImportOpen(false);
        setGithubUrl("");
        router.push(`/admin/skills/${skill.id}`);
      },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleCreate = () => {
    create.mutate(
      { name: newName, sourceType: "UPLOAD" },
      {
        onSuccess: (skill) => {
          setCreateOpen(false);
          setNewName("");
          router.push(`/admin/skills/${skill.id}`);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title="Skills"
        description="Agent skills shown on the landing site — import from GitHub or upload files, attach showcase media, publish."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <GithubLogo className="size-4" />
              Import from GitHub
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              New skill
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : !skills?.length ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm text-muted-foreground">
          <FilmSlate className="size-6" />
          No skills yet — import one from GitHub or create one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {skills.map((skill) => (
            <Link
              key={skill.id}
              href={`/admin/skills/${skill.id}`}
              className="flex items-center gap-4 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">
                    {skill.name}
                  </span>
                  <Badge
                    variant={
                      skill.status === "PUBLISHED" ? "default" : "secondary"
                    }
                  >
                    {skill.status === "PUBLISHED" ? "Published" : "Draft"}
                  </Badge>
                </div>
                <div className="mt-0.5 truncate text-sm text-muted-foreground">
                  /skills/{skill.slug}
                  {skill.tagline ? ` — ${skill.tagline}` : ""}
                </div>
              </div>
              <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
                <span className="inline-flex items-center gap-1">
                  {skill.sourceType === "GITHUB" ? (
                    <GithubLogo className="size-3.5" />
                  ) : (
                    <ArrowSquareOut className="size-3.5" />
                  )}
                  {skill.sourceType === "GITHUB" ? "GitHub" : "Upload"}
                </span>
                <span className="tabular-nums">
                  {skill._count.media} media
                </span>
                <span className="tabular-nums">
                  {timeAgo(skill.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import skill from GitHub</DialogTitle>
            <DialogDescription>
              Paste a repo URL containing a SKILL.md — name and description
              are read from its frontmatter and a draft is created.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="https://github.com/owner/skill-repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && githubUrl && handleImport()}
          />
          <DialogFooter>
            <Button
              onClick={handleImport}
              disabled={!githubUrl || importGithub.isPending}
            >
              {importGithub.isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New skill</DialogTitle>
            <DialogDescription>
              Creates an empty draft — upload the skill files and fill in the
              page content in the editor.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Skill name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && newName && handleCreate()}
          />
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={!newName || create.isPending}
            >
              {create.isPending ? "Creating…" : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
