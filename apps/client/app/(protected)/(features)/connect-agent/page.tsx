"use client";

import Link from "next/link";
import { BookOpen, Key } from "@phosphor-icons/react";
import {
  PageBody,
  PageHeader,
  PageSection,
} from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ConnectAgentTabs } from "@/components/agents/connect-agent-tabs";
import { AgentToolList } from "@/components/agents/agent-tool-list";
import { SetupVideos } from "@/components/agents/setup-videos";
import { DOCS_URL } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICON_ONLY_MOBILE = "max-sm:size-8 max-sm:p-0";

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        actions={
          <>
            {/* Icon-only below sm so the page title keeps its room. */}
            <Link
              href="/api-keys"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), ICON_ONLY_MOBILE)}
            >
              <Key />
              <span className="max-sm:sr-only">API keys</span>
            </Link>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), ICON_ONLY_MOBILE)}
            >
              <BookOpen />
              <span className="max-sm:sr-only">API docs</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </>
        }
      />
      <PageBody className="space-y-8">
        <PageSection
          title="Connect your agent"
          description="Unsora runs as an MCP server, so any MCP client can create, schedule and publish for you. Every tool is also a REST endpoint."
        >
          <ConnectAgentTabs />
        </PageSection>

        <PageSection
          title="What your agent can do"
          description="The tools your agent gets once it's connected."
        >
          <AgentToolList />
        </PageSection>

        <PageSection
          title="Setup videos"
          description="Two short walkthroughs for Claude."
        >
          <SetupVideos />
        </PageSection>
      </PageBody>
    </>
  );
}
