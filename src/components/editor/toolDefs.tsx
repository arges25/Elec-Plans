import type { ReactNode } from 'react';
import { AppWindow, ArrowUpRight, BrickWall, Cable, Circle, DoorOpen, DraftingCompass, MousePointer2, Pencil, RectangleHorizontal, Ruler, SquareDashed, Type } from 'lucide-react';
import type { EditorTool } from '../../store/editorStore';

export interface ToolDef {
  id: EditorTool;
  label: string;
  icon: ReactNode;
  hint: string;
  group: 'base' | 'plan' | 'annot' | 'measure';
}

const I = 'size-5';

export const TOOL_DEFS: ToolDef[] = [
  { id: 'select', label: 'Sélection', icon: <MousePointer2 className={I} aria-hidden />, hint: 'Touchez un élément pour le sélectionner, glissez pour le déplacer.', group: 'base' },
  { id: 'connect', label: 'Relier', icon: <Cable className={I} aria-hidden />, hint: 'Touchez la commande puis les éléments à relier.', group: 'base' },
  { id: 'wall', label: 'Mur', icon: <BrickWall className={I} aria-hidden />, hint: 'Touchez pour poser chaque angle du mur. Double toucher pour terminer.', group: 'plan' },
  { id: 'door', label: 'Porte', icon: <DoorOpen className={I} aria-hidden />, hint: 'Touchez un mur pour ajouter une porte.', group: 'plan' },
  { id: 'window', label: 'Fenêtre', icon: <AppWindow className={I} aria-hidden />, hint: 'Touchez un mur pour ajouter une fenêtre.', group: 'plan' },
  { id: 'room', label: 'Pièce', icon: <SquareDashed className={I} aria-hidden />, hint: 'Glissez pour tracer une pièce rectangulaire, ou touchez pour nommer une pièce.', group: 'plan' },
  { id: 'text', label: 'Texte', icon: <Type className={I} aria-hidden />, hint: 'Touchez le plan pour ajouter un texte.', group: 'annot' },
  { id: 'arrow', label: 'Flèche', icon: <ArrowUpRight className={I} aria-hidden />, hint: 'Glissez pour tracer une flèche.', group: 'annot' },
  { id: 'circle', label: 'Cercle', icon: <Circle className={I} aria-hidden />, hint: 'Glissez pour tracer un cercle.', group: 'annot' },
  { id: 'rect', label: 'Rectangle', icon: <RectangleHorizontal className={I} aria-hidden />, hint: 'Glissez pour tracer un rectangle.', group: 'annot' },
  { id: 'pen', label: 'Crayon', icon: <Pencil className={I} aria-hidden />, hint: 'Dessinez à main levée.', group: 'annot' },
  { id: 'measure', label: 'Mesure', icon: <Ruler className={I} aria-hidden />, hint: 'Touchez le point A puis le point B.', group: 'measure' },
  { id: 'scale', label: 'Échelle', icon: <DraftingCompass className={I} aria-hidden />, hint: 'Touchez A puis B, puis saisissez la longueur réelle.', group: 'measure' },
];

export function toolDef(id: EditorTool): ToolDef | undefined {
  return TOOL_DEFS.find((t) => t.id === id);
}
