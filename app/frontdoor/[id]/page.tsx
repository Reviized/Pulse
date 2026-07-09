import { notFound } from "next/navigation";
import { getExperience, getSlidesForExperience } from "@/lib/data/experiences";
import { SlideViewer } from "@/components/slide-viewer";

export const dynamic = "force-dynamic";

export default async function FrontDoorPage({
  params,
}: {
  params: { id: string };
}) {
  const experience = await getExperience(params.id);
  if (!experience) notFound();

  const slides = await getSlidesForExperience(params.id);
  if (slides.length === 0) notFound();

  return <SlideViewer experienceId={experience.id} slides={slides} />;
}
