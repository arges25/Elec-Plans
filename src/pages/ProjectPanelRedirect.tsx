import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { getOrCreateProjectPanel } from '../database/panelRepository';

/** Ouvre (ou crée) le tableau électrique du projet. */
export default function ProjectPanelRedirect() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (!projectId) return;
    void getOrCreateProjectPanel(projectId).then((panel) => navigate(`/panel/${panel.id}`, { replace: true }));
  }, [projectId, navigate]);
  return (
    <div className="flex h-dvh items-center justify-center text-gray-500" role="status">
      <Loader2 className="mr-2 size-6 animate-spin text-brand-500" aria-hidden /> Ouverture du tableau…
    </div>
  );
}
