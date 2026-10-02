import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Composer } from "@/components/composer/composer";
import { FORMATS, type PostFormat } from "@/lib/scheduler/formats";

export default async function ComposePage({
  params,
}: {
  params: Promise<{ format: string }>;
}) {
  const { format } = await params;
  if (!(format in FORMATS)) notFound();
  return (
    <Suspense>
      <Composer initialFormat={format as PostFormat} />
    </Suspense>
  );
}

export function generateStaticParams() {
  return Object.keys(FORMATS).map((format) => ({ format }));
}
