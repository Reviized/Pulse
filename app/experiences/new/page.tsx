"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createExperience } from "@/lib/api/pulse-experiences";

export default function NewExperiencePage() {
  const router = useRouter();
  const [sourceUrl, setSourceUrl] = useState("");
  const [mode, setMode] = useState<"inform" | "train" | "sell">("inform");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { id } = await createExperience({ source_url: sourceUrl, mode });
      router.push(`/experiences/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create experience");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-2xl font-semibold">New experience</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Source URL
          <input
            type="url"
            required
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="https://example.com"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Mode
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
            className="rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="inform">Inform</option>
            <option value="train">Train</option>
            <option value="sell">Sell</option>
          </select>
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {submitting ? "Creating..." : "Create experience"}
        </button>
      </form>
    </main>
  );
}
