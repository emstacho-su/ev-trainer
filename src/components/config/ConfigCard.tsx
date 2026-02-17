import { cn } from '@/lib/utils';

interface ConfigCardProps {
  /** Card heading displayed at the top */
  title: string;
  /** Optional description shown below the title */
  subtitle?: string;
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable card wrapper for lobby and sidebar configuration sections.
 * Provides consistent border, background, and spacing for filter groups.
 */
export default function ConfigCard({
  title,
  subtitle,
  children,
  className,
}: ConfigCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-stone-300 bg-white p-4 dark:border-stone-700 dark:bg-stone-900',
        className
      )}
    >
      <div className="space-y-2">
        <div>
          <h3 className="font-semibold text-stone-900 dark:text-stone-100">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {subtitle}
            </p>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
