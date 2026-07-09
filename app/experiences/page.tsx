import Link from "next/link";
import { listExperiences } from "@/lib/data/experiences";

export const dynamic = "force-dynamic";

export default async function ExperiencesPage() {
  const experiences = await listExperiences();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Experiences</h1>
        <Link
          href="/experiences/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm text-white dark:bg-white dark:text-black"
        >
          New experience
        </Link>
      </div>

      {experiences.length === 0 ? (
        <p className="text-sm text-neutral-500">No experiences yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {experiences.map((experience) => (
            <li key={experience.id} className="py-3">
              <Link
                href={`/experiences/${experience.id}`}
                className="flex items-center justify-between hover:underline"
              >
                <span>
                  {experience.name ?? experience.company_name ?? experience.id}
                </span>
                <span className="text-xs uppercase text-neutral-500">
                  {experience.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
