import { notFound } from "next/navigation";
import { getExperience } from "@/lib/data/experiences";
import { getModulesForRating } from "./actions";
import { TrainFlow } from "./train-flow";

export const dynamic = "force-dynamic";

export default async function TrainPage({ params }: { params: { id: string } }) {
  const experience = await getExperience(params.id);
  if (!experience) notFound();

  const modules = await getModulesForRating(params.id);

  return (
    <TrainFlow
      experienceId={experience.id}
      companyName={experience.company_name ?? "This Company"}
      accessCode={experience.access_code}
      narrator={experience.narrator}
      modules={modules}
    />
  );
}
