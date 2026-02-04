/**
 * Overview: Reusable card link for entering a specific mode.
 * Interacts with: Home page mode grid.
 * Importance: Keeps mode entry UI consistent and easy to extend.
 */

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
      className="surface-card block p-4 transition hover:border-borderSubtle hover:bg-surfaceMuted"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-muted mt-2 text-sm">{description}</p>
    </Link>
  );
}
