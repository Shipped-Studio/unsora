/**
 * One-time seed: move the skills that were hardcoded in
 * landing/src/lib/skills.ts (+ their showcase videos from
 * showcase-videos.ts) into the database, PUBLISHED, preserving order.
 *
 * The data snapshot lives in seed-skills-data.json (generated from the
 * landing source). Safe to re-run: existing slugs are skipped.
 *
 *   npx ts-node scripts/seed-skills.ts
 */
import { PrismaClient } from "@prisma/client";
import seedData from "./seed-skills-data.json";

const prisma = new PrismaClient();

interface SeedSkill {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  githubUrl: string;
  downloadPath: string;
  installCommand: string;
  highlights: string[];
  steps: { num: string; title: string; body: string }[];
  examples: string[];
  requirements: string[];
  ctaHeadline: string;
  ctaBody: string;
  sortOrder: number;
  media: { type: "VIDEO"; url: string; label: string; aspect: string; sortOrder: number }[];
}

async function main() {
  for (const s of seedData as SeedSkill[]) {
    const existing = await prisma.skill.findUnique({ where: { slug: s.slug } });
    if (existing) {
      console.log(`skip (exists): ${s.slug}`);
      continue;
    }
    await prisma.skill.create({
      data: {
        slug: s.slug,
        name: s.name,
        tagline: s.tagline,
        description: s.description,
        sourceType: "GITHUB",
        githubUrl: s.githubUrl,
        installCommand: s.installCommand,
        highlights: s.highlights,
        steps: s.steps,
        examples: s.examples,
        requirements: s.requirements,
        ctaHeadline: s.ctaHeadline,
        ctaBody: s.ctaBody,
        status: "PUBLISHED",
        sortOrder: s.sortOrder,
        media: {
          create: s.media.map((m) => ({
            type: m.type,
            url: m.url,
            label: m.label,
            aspect: m.aspect,
            sortOrder: m.sortOrder,
          })),
        },
      },
    });
    console.log(`seeded: ${s.slug} (${s.media.length} media)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
