interface ToolGroup {
  title: string;
  tools: { name: string; description: string }[];
}

const PUBLISH: ToolGroup = {
  title: "Publish",
  tools: [
    {
      name: "create_post",
      description: "Save a draft, schedule a post or publish now, to one or more accounts",
    },
    { name: "publish_post", description: "Publish a draft or scheduled post now" },
    { name: "list_posts", description: "List draft and scheduled posts" },
    {
      name: "get_post_analytics",
      description: "Views, likes, comments and shares for published posts",
    },
    { name: "get_accounts", description: "List your connected social accounts" },
  ],
};

const CREATE: ToolGroup = {
  title: "Create",
  tools: [
    { name: "create_video", description: "Video from a prompt or reference images" },
    { name: "create_image", description: "Generate or edit an image" },
    { name: "create_thumbnail", description: "YouTube thumbnail from a prompt" },
    { name: "create_clipping", description: "Cut short clips out of a long video" },
    { name: "create_music", description: "A song from lyrics and a style" },
    { name: "create_voiceover", description: "Speech from text with a stock or cloned voice" },
    { name: "create_avatar_video", description: "A portrait that speaks your script" },
    {
      name: "create_motion_control",
      description: "Animate a character with a reference video",
    },
    { name: "upscale_image", description: "Increase image resolution" },
    { name: "upscale_video", description: "Increase video resolution" },
  ],
};

const LIBRARY: ToolGroup = {
  title: "Library",
  tools: [
    { name: "upload_file", description: "Import a file from a URL into your Library" },
    {
      name: "list_generations",
      description: "Find earlier results by type, with status and file URLs",
    },
    { name: "list_uploads", description: "List files you've uploaded" },
  ],
};

function Group({ group }: { group: ToolGroup }) {
  return (
    <div className="overflow-hidden rounded-xl bg-muted">
      <h3 className="border-b border-card px-4 py-2.5 text-sm font-medium">{group.title}</h3>
      <dl className="divide-y divide-card">
        {group.tools.map((tool) => (
          <div
            key={tool.name}
            className="grid grid-cols-1 gap-0.5 px-4 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-3"
          >
            <dt>
              <code className="font-mono text-xs text-foreground">{tool.name}</code>
            </dt>
            <dd className="text-sm text-muted-foreground">{tool.description}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The MCP tools an agent gets, grouped by what they're for. */
export function AgentToolList() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
      <div className="space-y-4">
        <Group group={PUBLISH} />
        <Group group={LIBRARY} />
      </div>
      <Group group={CREATE} />
    </div>
  );
}
