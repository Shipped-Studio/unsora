import Link from "next/link";
import { UnsoraLogo } from "@/components/brand/unsora-logo";
import { AuthShowcase } from "./_components/auth-showcase";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Link href="https://tryunsora.com" className="inline-flex w-fit">
          <UnsoraLogo variant="full" priority className="h-7" />
        </Link>

        <main className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </main>

        <footer className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <a href="https://tryunsora.com/terms" className="hover:text-foreground">
            Terms
          </a>
          <a href="https://tryunsora.com/privacy" className="hover:text-foreground">
            Privacy
          </a>
          <a href="https://tryunsora.com/docs" className="hover:text-foreground">
            Docs
          </a>
        </footer>
      </div>

      <aside className="hidden border-l bg-muted/40 lg:flex">
        <AuthShowcase />
      </aside>
    </div>
  );
}
