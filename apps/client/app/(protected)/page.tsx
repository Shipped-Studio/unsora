import Link from "next/link";
import type { Metadata } from "next";
import { NotePencil } from "@phosphor-icons/react/dist/ssr";
import { HomeView } from "@/components/home/home-view";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Home" };

export default function HomePage() {
  return (
    <>
      <PageHeader
        actions={
          <Link href="/scheduler/new" className={buttonVariants()}>
            <NotePencil />
            New post
          </Link>
        }
      />
      <PageBody>
        <HomeView />
      </PageBody>
    </>
  );
}
