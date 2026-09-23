import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Loader2 } from 'lucide-react';
import { getProjectPlans } from '../database/projectRepository';
import { isPlanEmpty } from '../utils/planFactory';

/** Ouvre le premier plan du projet (ou l'import si le plan est vide). */
export default function ProjectRedirect() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (!projectId) return;
    void getProjectPlans(projectId).then(async (plans) => {
      const plan = plans[0];
      if (!plan) {
        navigate('/', { replace: true });
        return;
      }
      const { db } = await import('../database/db');
      const symbolCount = await db.symbolsPlaced.where('planId').equals(plan.id).count();
      const target = isPlanEmpty(plan) && symbolCount === 0 ? `/project/${projectId}/plan/${plan.id}/import` : `/project/${projectId}/plan/${plan.id}`;
      navigate(target, { replace: true });
    });
  }, [projectId, navigate]);
  return (
    <div className="flex h-dvh items-center justify-center text-gray-500" role="status">
      <Loader2 className="mr-2 size-6 animate-spin text-brand-500" aria-hidden /> Ouverture du chantier…
    </div>
  );
}
