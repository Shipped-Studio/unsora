"use client";

import Link from "next/link";
import { ArrowSquareOut } from "@phosphor-icons/react";
import {
  PageBody,
  PageHeader,
  PageSection,
} from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ConnectAgentTabs } from "@/components/agents/connect-agent-tabs";
import { AgentToolList } from "@/components/agents/agent-tool-list";
import { AgentActivity } from "@/components/agents/agent-activity";
import { SetupVideos } from "@/components/agents/setup-videos";
import { DOCS_URL } from "@/lib/navigation";

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Link
              href="/api-keys"
              className={buttonVariants({ variant: "outline" })}
            >
              API keys
            </Link>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "ghost" })}
            >
              API docs
              <ArrowSquareOut />
            </a>
          </>
        }
      />
      <PageBody width="default" className="space-y-8">
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
          title="Recent agent activity"
          description="The latest files made with an API key, including jobs still running."
          actions={
            <Link
              href="/files?source=api"
              className={buttonVariants({ variant: "ghost" })}
            >
              View in Library
            </Link>
          }
        >
          <AgentActivity />
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
