import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Check, Plus } from 'lucide-react';
import type { FloorType } from '../types';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SelectField, TextArea, TextField } from '../components/ui/Field';
import { createProject, getProject, updateProject } from '../database/projectRepository';
import { FLOOR_OPTIONS } from '../utils/planFactory';
import { todayIso } from '../utils/format';
import { toast } from '../store/toastStore';

interface FormState {
  name: string;
  clientName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  notes: string;
  date: string;
  floorType: FloorType;
  customFloorName: string;
}

const EMPTY: FormState = {
  name: '',
  clientName: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  notes: '',
  date: todayIso(),
  floorType: 'rdc',
  customFloorName: '',
};

/** Création (ou modification des informations) d'un chantier. */
export default function NewProjectPage() {
  const { projectId } = useParams();
  const editing = Boolean(projectId);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    void getProject(projectId).then((p) => {
      if (!p) return;
      setForm({
        name: p.name,
        clientName: p.clientName,
        address: p.address,
        city: p.city,
        phone: p.phone ?? '',
        email: p.email ?? '',
        notes: p.notes,
        date: p.date,
        floorType: p.floors[0]?.type ?? 'rdc',
        customFloorName: '',
      });
    });
  }, [projectId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setNameError('Donnez un nom au chantier (ex. Maison Martin).');
      return;
    }
    setSaving(true);
    try {
      if (editing && projectId) {
        await updateProject(projectId, {
          name: form.name.trim(),
          clientName: form.clientName.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          notes: form.notes,
          date: form.date,
        });
        toast.success('Projet sauvegardé ✓');
        navigate(-1);
      } else {
        const { project, plan } = await createProject(form);
        // Demande un stockage persistant (évite l'effacement automatique par le navigateur).
        void navigator.storage?.persist?.();
        toast.success('Chantier créé ✓');
        navigate(`/project/${project.id}/plan/${plan.id}/import`, { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh">
      <AppHeader title={editing ? 'Informations du chantier' : 'Nouveau chantier'} back />
      <PageBody className="max-w-2xl">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Card className="flex flex-col gap-4 p-4">
            <TextField
              label="Nom du chantier *"
              placeholder="Maison Martin"
              value={form.name}
              onValueChange={(v) => {
                set('name', v);
                setNameError(null);
              }}
              error={nameError}
              autoFocus={!editing}
              autoComplete="off"
            />
            <TextField
              label="Nom du client"
              placeholder="M. et Mme Martin"
              value={form.clientName}
              onValueChange={(v) => set('clientName', v)}
              autoComplete="name"
            />
            <TextField
              label="Adresse"
              placeholder="12 rue des Lilas"
              value={form.address}
              onValueChange={(v) => set('address', v)}
              autoComplete="street-address"
            />
            <TextField label="Ville" placeholder="Lyon" value={form.city} onValueChange={(v) => set('city', v)} autoComplete="address-level2" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Téléphone (facultatif)"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onValueChange={(v) => set('phone', v)}
                autoComplete="tel"
              />
              <TextField
                label="Email (facultatif)"
                type="email"
                inputMode="email"
                value={form.email}
                onValueChange={(v) => set('email', v)}
                autoComplete="email"
              />
            </div>
          </Card>
          <Card className="flex flex-col gap-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Date" type="date" value={form.date} onValueChange={(v) => set('date', v)} />
              {!editing && (
                <SelectField
                  label="Étage"
                  value={form.floorType}
                  onValueChange={(v) => set('floorType', v as FloorType)}
                  options={FLOOR_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
                />
              )}
            </div>
            {!editing && form.floorType === 'custom' && (
              <TextField
                label="Nom du niveau"
                placeholder="Combles, Dépendance…"
                value={form.customFloorName}
                onValueChange={(v) => set('customFloorName', v)}
              />
            )}
            <TextArea label="Notes" placeholder="Accès, contraintes, demandes du client…" value={form.notes} onValueChange={(v) => set('notes', v)} />
          </Card>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={saving}
            icon={editing ? <Check className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />}
          >
            {editing ? 'Enregistrer' : 'Créer le chantier'}
          </Button>
        </form>
      </PageBody>
    </div>
  );
}
