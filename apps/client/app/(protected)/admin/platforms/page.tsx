"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { PlatformCredentialsDialog } from "@/components/admin/platform-credentials-dialog";
import { PlatformIcon } from "@/components/scheduler/platform-icon";
import { ErrorState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  useAdminPlatforms,
  useSavePlatforms,
  type AdminPlatform,
} from "@/hooks/admin/use-admin-platforms";

const SOURCE_NOTE = {
  admin: null,
  env: "Switches currently come from the ENABLED_PLATFORMS variable. Changing one here saves them all here, and this page takes over.",
  default:
    "Nothing is saved yet, so every platform with credentials is on. Changing a switch saves them all here.",
} as const;

function status(platform: AdminPlatform) {
  if (platform.live) return { label: "Live", variant: "default" as const };
  if (platform.missingCredentials.length) {
    return { label: "Missing credentials", variant: "outline" as const };
  }
  return { label: "Coming soon", variant: "secondary" as const };
}

export default function AdminPlatformsPage() {
  const { data, isLoading, error, refetch } = useAdminPlatforms();
  const save = useSavePlatforms();
  const [editing, setEditing] = useState<string | null>(null);
  const editingPlatform = data?.platforms.find((p) => p.id === editing) ?? null;

  const toggle = (id: string, on: boolean) => {
    if (!data) return;
    const enabled = data.platforms
      .filter((p) => (p.id === id ? on : p.switchedOn))
      .map((p) => p.id);
    const name = data.platforms.find((p) => p.id === id)?.name ?? id;
    save.mutate(enabled, {
      onSuccess: () => toast.success(`${name} ${on ? "switched on" : "switched off"}`),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <AdminPage
      title="Platforms"
      description="Choose which social platforms users can connect and post to"
    >
      {error && !data ? (
        <ErrorState
          title="Couldn't load platforms"
          description={error.message}
          onRetry={() => void refetch()}
        />
      ) : isLoading || !data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {SOURCE_NOTE[data.source] ? (
            <p className="text-sm text-muted-foreground">{SOURCE_NOTE[data.source]}</p>
          ) : null}
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-muted">
            {data.platforms.map((platform) => {
              const badge = status(platform);
              return (
                <li key={platform.id} className="flex items-center gap-3 px-4 py-3">
                  <PlatformIcon provider={platform.id} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{platform.name}</span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                    {platform.missingCredentials.length ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        Missing {platform.missingCredentials.join(", ")}. Add it with Edit keys.
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(platform.id)}
                  >
                    Edit keys
                  </Button>
                  <Switch
                    checked={platform.switchedOn}
                    disabled={save.isPending}
                    aria-label={`${platform.name} switched on`}
                    onCheckedChange={(on) => toggle(platform.id, on)}
                  />
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Users see switched-off platforms as &ldquo;Coming soon&rdquo;. Changes apply
            within about 30 seconds. Keys saved here are encrypted and override the
            Railway values; anything not set here still comes from Railway.
          </p>
          <PlatformCredentialsDialog
            platform={editingPlatform}
            canSave={data.canSaveCredentials}
            onOpenChange={(open) => !open && setEditing(null)}
          />
        </div>
      )}
    </AdminPage>
  );
}
