import Link from "next/link";

interface ModeEntryCardProps {
  href: string;
  title: string;
  description: string;
}

export default function ModeEntryCard({
  href,
  title,
  description,
}: ModeEntryCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-stone-300 bg-white p-4 transition hover:border-stone-500"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-stone-600">{description}</p>
    </Link>
  );
}
