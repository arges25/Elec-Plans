import type { ReactNode } from 'react';
import { Copy, Download, FolderOpen, Layers, Trash2 } from 'lucide-react';
import type { Project } from '../../types';
import { formatRelativeDate, plural } from '../../utils/format';
import { Badge, Card } from '../ui/Card';

export interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
}

export function ProjectCard({ project, onOpen, onDuplicate, onDelete, onExport }: ProjectCardProps) {
  const stats = project.stats;
  const floors = project.floors.map((f) => f.name).join(' · ');
  return (
    <Card className="flex flex-col overflow-hidden">
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col gap-1 p-4 text-left hover:bg-gray-50" aria-label={`Ouvrir ${project.name}`}>
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate text-lg font-bold text-gray-900">{project.name}</h3>
          {project.isDemo && <Badge tone="yellow">Démo</Badge>}
        </div>
        {project.clientName && <p className="truncate text-sm text-gray-600">{project.clientName}</p>}
        <p className="flex items-center gap-1.5 truncate text-sm text-gray-600">
          <Layers className="size-4 shrink-0 text-gray-400" aria-hidden />
          {floors || 'Aucun niveau'}
        </p>
        <p className="text-xs text-gray-500">Modifié {formatRelativeDate(project.updatedAt)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="blue">{plural(stats?.sockets ?? 0, 'prise')}</Badge>
          <Badge tone="orange">{plural(stats?.lights ?? 0, 'éclairage')}</Badge>
          <Badge tone="gray">{plural(stats?.switches ?? 0, 'commande')}</Badge>
        </div>
      </button>
      <div className="grid grid-cols-4 border-t border-gray-100">
        <CardAction label="Ouvrir" icon={<FolderOpen className="size-5" aria-hidden />} onClick={onOpen} primary />
        <CardAction label="Dupliquer" icon={<Copy className="size-5" aria-hidden />} onClick={onDuplicate} />
        <CardAction label="Exporter" icon={<Download className="size-5" aria-hidden />} onClick={onExport} />
        <CardAction label="Supprimer" icon={<Trash2 className="size-5" aria-hidden />} onClick={onDelete} danger />
      </div>
    </Card>
  );
}

function CardAction({ label, icon, onClick, primary, danger }: { label: string; icon: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors hover:bg-gray-50 ${
        primary ? 'text-brand-600' : danger ? 'text-red-600' : 'text-gray-600'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
