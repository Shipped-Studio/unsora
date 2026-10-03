import Link from "next/link";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { AuthShowcase } from "./_components/auth-showcase";

const FOOTER_LINKS = [
  { href: "https://tryunsora.com/terms", label: "Terms" },
  { href: "https://tryunsora.com/privacy", label: "Privacy" },
  { href: "https://tryunsora.com/docs", label: "Docs" },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link href="https://tryunsora.com" className="inline-flex w-fit rounded-md">
          <UnsoraLogo variant="full" priority className="h-7" />
        </Link>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Unsora</span>
          {FOOTER_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="rounded-sm hover:text-foreground">
              {link.label}
            </a>
          ))}
        </footer>
      </div>

      <aside className="hidden p-3 lg:flex">
        <AuthShowcase />
      </aside>
    </div>
  );
}
