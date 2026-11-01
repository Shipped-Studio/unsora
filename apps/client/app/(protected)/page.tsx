import type { Metadata } from "next";
import { HomeView } from "@/components/home/home-view";
import { PageBody, PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <>
      <PageHeader />
      <PageBody>
        <HomeView />
      </PageBody>
    </>
  );
}
