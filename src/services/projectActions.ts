import type { Project } from '../types';
import { deleteProject } from '../database/projectRepository';
import { confirmDialog } from '../store/dialogStore';
import { toast } from '../store/toastStore';
import { duplicateProject, exportProjectFile, importProjectFile } from './projectTransfer';

/** Actions projet communes (accueil, liste des chantiers). */
export async function confirmAndDeleteProject(project: Project): Promise<boolean> {
  const ok = await confirmDialog({
    title: `Supprimer définitivement ${project.name} ?`,
    message: 'Le plan, les symboles, les liaisons et le tableau seront supprimés de cet appareil.',
    confirmLabel: 'Supprimer',
    cancelLabel: 'Annuler',
    danger: true,
  });
  if (!ok) return false;
  await deleteProject(project.id);
  toast.success('Projet supprimé');
  return true;
}

export async function duplicateProjectWithToast(project: Project): Promise<string | null> {
  try {
    const id = await duplicateProject(project.id);
    toast.success('Projet dupliqué ✓');
    return id;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Duplication impossible');
    return null;
  }
}

export async function exportProjectWithToast(project: Project): Promise<void> {
  try {
    await exportProjectFile(project.id);
    toast.success('Projet exporté (.mgeplan) ✓');
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Export impossible');
  }
}

export async function importProjectWithToast(file: File): Promise<string | null> {
  try {
    const id = await importProjectFile(file);
    toast.success('Projet importé ✓');
    return id;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Format non pris en charge');
    return null;
  }
}
