import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, FileUp, FolderOpen, Plus, Search, Settings, Sparkles, Tags } from 'lucide-react';
import { db } from '../database/db';
import { LogoFull } from '../components/layout/Logo';
import { ProjectCard } from '../components/projects/ProjectCard';
import { OnboardingTour } from '../components/onboarding/OnboardingTour';
import { InstallPrompt } from '../components/onboarding/InstallPrompt';
import { Button } from '../components/ui/Button';
import { EmptyState, SectionTitle } from '../components/ui/Card';
import { useSettingsStore } from '../store/settingsStore';
import { createDemoProject } from '../services/demo';
import { toast } from '../store/toastStore';
import { confirmAndDeleteProject, duplicateProjectWithToast, exportProjectWithToast, importProjectWithToast } from '../services/projectActions';
import { MGEPLAN_EXTENSION } from '../services/projectTransfer';

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function HomePage() {
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);
  const loaded = useSettingsStore((s) => s.loaded);
  const update = useSettingsStore((s) => s.update);
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []);
  const [query, setQuery] = useState('');
  const [installClosed, setInstallClosed] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!projects) return [];
    const q = normalize(query.trim());
    if (!q) return projects;
    return projects.filter((p) => normalize(`${p.name} ${p.clientName} ${p.address} ${p.city}`).includes(q));
  }, [projects, query]);

  const recent = query ? filtered : filtered.slice(0, 6);
  const hasDemo = projects?.some((p) => p.isDemo);

  const openDemo = async () => {
    setCreatingDemo(true);
    try {
      const id = await createDemoProject();
      update({ demoOffered: true });
      toast.success('Projet de démonstration créé ✓');
      navigate(`/project/${id}`);
    } finally {
      setCreatingDemo(false);
    }
  };

  const quickLinks = [
    { to: '/projects', label: 'Mes chantiers', icon: FolderOpen, desc: `${projects?.length ?? 0} projet(s)` },
    { to: '/library', label: 'Bibliothèque électrique', icon: BookOpen, desc: '150+ symboles' },
    { to: '/labels', label: 'Étiquettes tableau', icon: Tags, desc: 'Legrand · Schneider · Hager' },
    { to: '/settings', label: 'Réglages', icon: Settings, desc: 'Éditeur, impression…' },
  ];

  return (
    <div className="min-h-dvh bg-gray-50">
      {loaded && !settings.onboardingDone && <OnboardingTour onDone={() => update({ onboardingDone: true })} />}

      <header className="bg-ink-900 pt-safe text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-safe-4 py-4 ">
          <LogoFull />
          <button
            type="button"
            aria-label="Réglages"
            onClick={() => navigate('/settings')}
            className="inline-flex size-11 items-center justify-center rounded-xl text-gray-200 hover:bg-white/10"
          >
            <Settings className="size-6" aria-hidden />
          </button>
        </div>
        <div className="mx-auto max-w-6xl px-safe-4 pb-6 ">
          <Button
            variant="primary"
            size="lg"
            block
            className="text-lg sm:w-auto sm:px-8"
            icon={<Plus className="size-6" aria-hidden />}
            onClick={() => navigate('/new')}
          >
            Nouveau chantier
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-safe-4 pb-24 pt-4 ">
        {!installClosed && settings.onboardingDone && (
          <div className="mb-4">
            <InstallPrompt onClose={() => setInstallClosed(true)} />
          </div>
        )}

        <nav aria-label="Accès rapide" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {quickLinks.map((l) => (
            <button
              key={l.to}
              type="button"
              onClick={() => navigate(l.to)}
              className="flex min-h-24 flex-col items-start gap-2 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 hover:shadow"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <l.icon className="size-5" aria-hidden />
              </span>
              <span className="font-bold leading-tight text-gray-900">{l.label}</span>
              <span className="text-xs text-gray-500">{l.desc}</span>
            </button>
          ))}
        </nav>

        <div className="relative mt-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un chantier"
            aria-label="Rechercher un chantier"
            className="min-h-12 w-full rounded-2xl border border-gray-300 bg-white pl-10 pr-4 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
        </div>

        <SectionTitle
          action={
            <Button size="sm" variant="ghost" icon={<FileUp className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>
              Importer un projet
            </Button>
          }
        >
          {query ? `Résultats (${filtered.length})` : 'Derniers projets'}
        </SectionTitle>
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

        {projects && projects.length === 0 && (
          <EmptyState
            icon={<Sparkles className="size-10 text-brand-500" aria-hidden />}
            title="Aucun chantier pour le moment"
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="primary" icon={<Plus className="size-5" aria-hidden />} onClick={() => navigate('/new')}>
                  Nouveau chantier
                </Button>
                <Button onClick={openDemo} loading={creatingDemo}>
                  Voir un projet de démonstration
                </Button>
              </div>
            }
          >
            Créez votre premier chantier ou découvrez l’application avec la <strong>Maison Démo</strong> (salon, cuisine, chambre, SDB déjà équipés).
          </EmptyState>
        )}

        {projects && projects.length > 0 && recent.length === 0 && (
          <p className="py-6 text-center text-gray-500">Aucun chantier ne correspond à « {query} ».</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((p) => (
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

        {projects && projects.length > 6 && !query && (
          <div className="mt-4 text-center">
            <Button onClick={() => navigate('/projects')}>Voir tous mes chantiers ({projects.length})</Button>
          </div>
        )}

        {projects && projects.length > 0 && !hasDemo && (
          <div className="mt-6 flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
            <Sparkles className="size-6 shrink-0 text-brand-500" aria-hidden />
            <p className="flex-1 text-sm text-gray-600">Besoin d’un exemple ? La Maison Démo montre un plan complet avec liaisons et tableau.</p>
            <Button size="sm" onClick={openDemo} loading={creatingDemo}>
              Voir un projet de démonstration
            </Button>
          </div>
        )}

        <p className="mt-10 text-center text-xs text-gray-400">
          Vos projets sont stockés localement sur cet appareil. ·{' '}
          <button type="button" className="underline" onClick={() => navigate('/about')}>
            À propos
          </button>
        </p>
      </main>
    </div>
  );
}
