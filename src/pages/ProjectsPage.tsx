import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileUp, Plus, Search } from 'lucide-react';
import { db } from '../database/db';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { ProjectCard } from '../components/projects/ProjectCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Card';
import { IconButton } from '../components/ui/IconButton';
import { Segmented } from '../components/ui/Field';
import { confirmAndDeleteProject, duplicateProjectWithToast, exportProjectWithToast, importProjectWithToast } from '../services/projectActions';
import { MGEPLAN_EXTENSION } from '../services/projectTransfer';

type Sort = 'recent' | 'name';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useLiveQuery(() => db.projects.toArray(), []);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const filtered = (projects ?? []).filter((p) =>
      `${p.name} ${p.clientName} ${p.address} ${p.city}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q),
    );
    return filtered.sort((a, b) => (sort === 'recent' ? b.updatedAt - a.updatedAt : a.name.localeCompare(b.name, 'fr')));
  }, [projects, query, sort]);

  return (
    <div className="min-h-dvh">
      <AppHeader
        title="Mes chantiers"
        subtitle={projects ? `${projects.length} projet(s) sur cet appareil` : undefined}
        back="/"
        actions={
          <>
            <IconButton
              tone="dark"
              label="Importer un projet MG Elec & Plans"
              icon={<FileUp className="size-5" aria-hidden />}
              onClick={() => fileRef.current?.click()}
            />
            <IconButton tone="brand" label="Nouveau chantier" icon={<Plus className="size-5" aria-hidden />} onClick={() => navigate('/new')} />
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept={`${MGEPLAN_EXTENSION},application/json,.json`}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const id = await importProjectWithToast(f);
          if (id) navigate(`/project/${id}`);
        }}
      />
      <PageBody>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un chantier"
              aria-label="Rechercher un chantier"
              className="min-h-12 w-full rounded-2xl border border-gray-300 bg-white pl-10 pr-4 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="sm:w-64">
            <Segmented<Sort>
              ariaLabel="Trier"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'recent', label: 'Récents' },
                { value: 'name', label: 'Nom A→Z' },
              ]}
            />
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onOpen={() => navigate(`/project/${p.id}`)}
              onDuplicate={() => void duplicateProjectWithToast(p)}
              onDelete={() => void confirmAndDeleteProject(p)}
              onExport={() => void exportProjectWithToast(p)}
            />
          ))}
        </div>
        {projects && list.length === 0 && (
          <EmptyState
            title={query ? 'Aucun résultat' : 'Aucun chantier'}
            action={
              <Button variant="primary" icon={<Plus className="size-5" aria-hidden />} onClick={() => navigate('/new')}>
                Nouveau chantier
              </Button>
            }
          />
        )}
      </PageBody>
    </div>
  );
}
