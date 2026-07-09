import Link from "next/link";
import { notFound } from "next/navigation";
import { getExperience, getSlidesForExperience } from "@/lib/data/experiences";

export const dynamic = "force-dynamic";

export default async function ExperienceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const experience = await getExperience(params.id);
  if (!experience) notFound();

  const slides = await getSlidesForExperience(params.id);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <Link href="/experiences" className="text-sm text-neutral-500 hover:underline">
        ← Experiences
      </Link>

      <h1 className="mt-2 text-2xl font-semibold">
        {experience.name ?? experience.company_name ?? experience.id}
      </h1>
      <p className="mb-6 text-sm text-neutral-500">
        {experience.mode} · {experience.status} · {slides.length} slides
      </p>

      {slides.length > 0 && (
        <Link
          href={`/frontdoor/${experience.id}`}
          className="mb-6 inline-block rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          View FrontDoor
        </Link>
      )}

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {slides.map((slide, i) => (
          <li key={slide.id} className="py-3 text-sm">
            <span className="mr-2 text-neutral-400">{i + 1}.</span>
            <span className="font-medium">{slide.headline ?? "(untitled slide)"}</span>
            <span className="ml-2 text-xs uppercase text-neutral-500">
              {slide.layout_type}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
