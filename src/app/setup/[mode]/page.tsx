import { redirect } from 'next/navigation';

/**
 * Superseded by TrainerLobby and TrainingConfigDialog.
 * Redirects to the training page for backwards compatibility.
 */
export default function SetupModePage() {
  redirect('/training');
}
