import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-24">
      <h1 className="text-3xl font-semibold">Pulse</h1>
      <Link
        href="/experiences"
        className="rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
      >
        View experiences
      </Link>
    </main>
  );
}
