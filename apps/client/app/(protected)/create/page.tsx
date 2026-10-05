import type { Metadata } from "next";
import { ToolCard } from "@/components/graphics/tool-card";
import { PageBody, PageHeader, PageSection } from "@/components/layout/page-header";
import { TOOL_GROUPS } from "@/lib/navigation";

export const metadata: Metadata = { title: "All tools" };

export default function CreatePage() {
  return (
    <>
      <PageHeader />
      <PageBody className="space-y-10">
        {TOOL_GROUPS.map((group) => (
          <PageSection key={group.label} title={group.label}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {group.hrefs.map((href) => (
                <ToolCard key={href} href={href} />
              ))}
            </div>
          </PageSection>
        ))}
      </PageBody>
    </>
  );
}
