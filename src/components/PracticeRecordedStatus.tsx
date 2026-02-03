/**
 * Overview: Practice-only acknowledgement panel after submit.
 * Interacts with: Session page practice submit state.
 * Importance: Enforces no mid-session EV feedback in Practice mode.
 */

interface PracticeRecordedStatusProps {
  visible: boolean;
}

export default function PracticeRecordedStatus({
  visible,
}: PracticeRecordedStatusProps) {
  if (!visible) return null;
  return (
    <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-800">
      Recorded
    </section>
  );
}
