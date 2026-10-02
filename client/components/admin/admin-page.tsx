"use client";

import type { ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { AdminNav } from "./admin-nav";

const ADMIN_CRUMB = { label: "Admin", href: "/admin" };

/**
 * Shell for every /admin page: the shared PageHeader (with an "Admin"
 * breadcrumb), the section links, then the page content.
 */
export function AdminPage({
  title,
  description,
  parents = [],
  actions,
  isRoot = false,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Extra crumbs between "Admin" and the title. */
  parents?: { label: string; href: string }[];
  actions?: ReactNode;
  /** The overview page is the root, so it gets no "Admin" crumb. */
  isRoot?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        description={description ?? null}
        parents={isRoot ? parents : [ADMIN_CRUMB, ...parents]}
        actions={actions}
      />
      <PageBody className="space-y-6">
        <AdminNav />
        {children}
      </PageBody>
    </>
  );
}
