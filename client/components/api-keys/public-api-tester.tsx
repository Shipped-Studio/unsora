"use client";

import { useCallback, useState } from "react";
import { Play } from "@phosphor-icons/react";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
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
import { Spinner } from "@/components/ui/spinner";
import {
  PUBLIC_CLIPPING_API,
  PUBLIC_IMAGE_API,
  PUBLIC_THUMBNAIL_API,
  PUBLIC_VIDEO_API,
  publicApiFetch,
} from "@/lib/public-api";

type AuthMode = "session" | "api-key";
type Resource = "video" | "image" | "thumbnail" | "clipping";

interface PublicApiTesterProps {
  suggestedApiKey?: string | null;
}

function extractId(json: Record<string, unknown>): string | undefined {
  const generation = json.generation as { id?: string } | undefined;
  if (generation?.id) return generation.id;
  const data = json.data as { id?: string } | undefined;
  if (data?.id) return data.id;
  if (typeof json.id === "string") return json.id;
  const gens = json.generations as Array<{ id?: string }> | undefined;
  if (gens?.[0]?.id) return gens[0].id;
  const list = json.data as Array<{ id?: string }> | undefined;
  if (Array.isArray(list) && list[0]?.id) return list[0].id;
  return undefined;
}

export function PublicApiTester({ suggestedApiKey }: PublicApiTesterProps) {
  const { getToken } = useAuth();
  const [resource, setResource] = useState<Resource>("video");
  const [authMode, setAuthMode] = useState<AuthMode>(
    suggestedApiKey ? "api-key" : "session",
  );
  const [apiKey, setApiKey] = useState(suggestedApiKey ?? "");
  const [recordId, setRecordId] = useState("");
  const [clipId, setClipId] = useState("");
  const [prompt, setPrompt] = useState("A calm ocean sunset, cinematic");
  const [loading, setLoading] = useState<string | null>(null);
  const [response, setResponse] = useState("");

  const resolveToken = useCallback(async (): Promise<string | null> => {
    if (authMode === "api-key") {
      const key = apiKey.trim();
      if (!key) {
        toast.error("Paste your API key");
        return null;
      }
      return key;
    }
    const token = await getToken();
    if (!token) toast.error("Not signed in");
    return token;
  }, [authMode, apiKey, getToken]);

  const run = useCallback(
    async (label: string, fn: (token: string) => Promise<Response>) => {
      setLoading(label);
      try {
        const token = await resolveToken();
        if (!token) return;

        const res = await fn(token);
        const text = await res.text();
        let formatted = text;
        try {
          formatted = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
          /* keep raw */
        }
        setResponse(`// ${label}\n// HTTP ${res.status}\n\n${formatted}`);
        if (!res.ok) {
          toast.error(`${label} failed (${res.status})`);
        } else {
          toast.success(`${label} OK`);
          try {
            const json = JSON.parse(text) as Record<string, unknown>;
            const id = extractId(json);
            if (id) setRecordId(id);
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed";
        setResponse(`// ${label}\n// Error\n\n${msg}`);
        toast.error(msg);
      } finally {
        setLoading(null);
      }
    },
    [resolveToken],
  );

  const id = recordId.trim();
  const basePath =
    resource === "video"
      ? "/api/v1/videos"
      : resource === "image"
        ? "/api/v1/image-generations"
        : resource === "thumbnail"
          ? "/api/v1/thumbnails"
          : "/api/v1/clippings";

  return (
    <div className="mx-5 mb-6 rounded-xl border bg-card px-5 py-5 sm:mx-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold">Test public API</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Calls <code className="text-xs">{basePath}/*</code> with your session
          or an API key — same routes external integrations use.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Resource</Label>
          <Select
            value={resource}
            onValueChange={(v) => setResource(v as Resource)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video">Video (Seedance 2.0)</SelectItem>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="thumbnail">Thumbnail</SelectItem>
              <SelectItem value="clipping">Clipping</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Authentication</Label>
          <Select
            value={authMode}
            onValueChange={(v) => setAuthMode(v as AuthMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="session">Clerk session (JWT)</SelectItem>
              <SelectItem value="api-key">API key</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {authMode === "api-key" && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="test-api-key">API key</Label>
            <Input
              id="test-api-key"
              type="password"
              placeholder="uns_live_…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="test-record-id">
            {resource === "clipping" ? "Clipping job ID" : "Generation ID"}
          </Label>
          <Input
            id="test-record-id"
            placeholder="From list, create, or get response"
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            className="font-mono text-xs"
          />
        </div>

        {resource === "clipping" && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="test-clip-id">Clip ID (delete clip only)</Label>
            <Input
              id="test-clip-id"
              placeholder="Optional — for DELETE …/clips/:clipId"
              value={clipId}
              onChange={(e) => setClipId(e.target.value)}
              className="font-mono text-xs"
            />
          </div>
        )}

        {(resource === "video" ||
          resource === "image" ||
          resource === "thumbnail") && (
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="test-prompt">Prompt (create only)</Label>
            <Input
              id="test-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => {
            if (resource === "video") {
              void run("GET /videos/all", (t) =>
                publicApiFetch(`${PUBLIC_VIDEO_API.list}?page=1&limit=5`, t),
              );
            } else if (resource === "image") {
              void run("GET /image-generations/all", (t) =>
                publicApiFetch(`${PUBLIC_IMAGE_API.list}?page=1&limit=5`, t),
              );
            } else if (resource === "thumbnail") {
              void run("GET /thumbnails", (t) =>
                publicApiFetch(PUBLIC_THUMBNAIL_API.list, t),
              );
            } else {
              void run("GET /clippings/all", (t) =>
                publicApiFetch(PUBLIC_CLIPPING_API.list, t),
              );
            }
          }}
        >
          {loading?.startsWith("GET") && loading.includes("all") ? (
            <Spinner className="size-4" />
          ) : (
            <Play className="size-4" />
          )}
          List
        </Button>

        {resource !== "clipping" && (
          <Button
            size="sm"
            variant="outline"
            disabled={!!loading || !id}
            onClick={() => {
              const path =
                resource === "video"
                  ? null
                  : resource === "image"
                    ? PUBLIC_IMAGE_API.get(id)
                    : PUBLIC_THUMBNAIL_API.get(id);
              if (!path) {
                toast.info("Video has no GET-by-id endpoint; use Status");
                return;
              }
              void run(`GET ${path}`, (t) => publicApiFetch(path, t));
            }}
          >
            Get
          </Button>
        )}

        {resource === "clipping" && (
          <Button
            size="sm"
            variant="outline"
            disabled={!!loading || !id}
            onClick={() =>
              void run("GET /clippings/:id", (t) =>
                publicApiFetch(PUBLIC_CLIPPING_API.get(id), t),
              )
            }
          >
            Get
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={!!loading}
          onClick={() => {
            if (resource === "video") {
              void run("POST /videos/create", (t) =>
                publicApiFetch(PUBLIC_VIDEO_API.create, t, {
                  method: "POST",
                  body: JSON.stringify({
                    prompt: prompt.trim(),
                    functionMode: "omni_reference",
                    ratio: "16:9",
                    duration: 5,
                  }),
                }),
              );
            } else if (resource === "image") {
              void run("POST /image-generations/create", (t) =>
                publicApiFetch(PUBLIC_IMAGE_API.create, t, {
                  method: "POST",
                  body: JSON.stringify({
                    prompt: prompt.trim(),
                    model: "nano-banana-2",
                    ratio: "auto",
                    resolution: "2k",
                  }),
                }),
              );
            } else if (resource === "thumbnail") {
              void run("POST /thumbnails/create", (t) =>
                publicApiFetch(PUBLIC_THUMBNAIL_API.create, t, {
                  method: "POST",
                  body: JSON.stringify({ prompt: prompt.trim(), variations: 1 }),
                }),
              );
            } else {
              void run("POST /clippings/create", (t) =>
                publicApiFetch(PUBLIC_CLIPPING_API.create, t, {
                  method: "POST",
                  body: JSON.stringify({
                    videoUrl: "https://example.com/sample.mp4",
                    targetDuration: "30-60",
                    limit: 3,
                  }),
                }),
              );
            }
          }}
        >
          Create
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={!!loading || !id}
          onClick={() => {
            const statusPath =
              resource === "video"
                ? PUBLIC_VIDEO_API.status(id)
                : resource === "clipping"
                  ? PUBLIC_CLIPPING_API.status(id)
                  : resource === "image"
                    ? PUBLIC_IMAGE_API.status(id)
                    : PUBLIC_THUMBNAIL_API.status(id);
            void run("GET status", (t) => publicApiFetch(statusPath, t));
          }}
        >
          Status
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={!!loading || !id}
          onClick={() => {
            const delPath =
              resource === "video"
                ? PUBLIC_VIDEO_API.delete(id)
                : resource === "image"
                  ? PUBLIC_IMAGE_API.delete(id)
                  : resource === "thumbnail"
                    ? PUBLIC_THUMBNAIL_API.delete(id)
                    : PUBLIC_CLIPPING_API.delete(id);
            void run("DELETE", (t) =>
              publicApiFetch(delPath, t, { method: "DELETE" }),
            );
          }}
        >
          Delete
        </Button>

        {resource === "clipping" && (
          <Button
            size="sm"
            variant="outline"
            disabled={!!loading || !id || !clipId.trim()}
            onClick={() =>
              void run("DELETE clip", (t) =>
                publicApiFetch(
                  PUBLIC_CLIPPING_API.deleteClip(id, clipId.trim()),
                  t,
                  { method: "DELETE" },
                ),
              )
            }
          >
            Delete clip
          </Button>
        )}
      </div>

      {response ? (
        <pre className="mt-4 max-h-72 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {response}
        </pre>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">
          Response JSON appears here. Create and list show credits usage like
          production.
        </p>
      )}
    </div>
  );
}
