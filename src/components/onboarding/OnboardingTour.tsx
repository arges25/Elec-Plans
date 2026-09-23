import { useState } from 'react';
import { Cable, Camera, Printer, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { LogoMark } from '../layout/Logo';

const STEPS = [
  { icon: Camera, title: 'Importez ou photographiez votre plan', text: 'Photo, scan, image, PDF ou simple croquis : partez de ce que vous avez sur le chantier.' },
  { icon: Zap, title: 'Placez vos symboles électriques', text: 'Prises, interrupteurs, éclairages, VMC, RJ45… plus de 150 symboles, aimantés aux murs.' },
  { icon: Cable, title: 'Reliez vos commandes aux éclairages', text: 'Des liaisons pointillées claires pour montrer qui commande quoi à votre client.' },
  { icon: Printer, title: 'Créez vos étiquettes et exportez le PDF', text: 'Étiquettes de tableau Legrand, Schneider, Hager calibrées au millimètre, plan PDF professionnel.' },
];

/** Tour guidé du premier lancement (4 écrans maximum). */
export function OnboardingTour({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-900 text-white pt-safe pb-safe" role="dialog" aria-modal="true" aria-label="Bienvenue dans MG Elec & Plans">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <LogoMark size={36} />
          <span className="font-bold">MG Elec &amp; Plans</span>
        </div>
        <button type="button" onClick={onDone} className="min-h-11 rounded-xl px-3 text-sm font-semibold text-gray-300 hover:bg-white/10">
          Passer
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center" key={step}>
        <div className="mb-8 flex size-28 items-center justify-center rounded-3xl bg-gradient-to-br from-volt-400 to-brand-500 shadow-2xl animate-pop-in">
          <Icon className="size-14 text-ink-900" aria-hidden />
        </div>
        <p className="mb-2 text-sm font-bold text-brand-400">
          {step + 1} / {STEPS.length}
        </p>
        <h2 className="max-w-md text-2xl font-extrabold leading-tight">{s.title}</h2>
        <p className="mt-3 max-w-md text-gray-300">{s.text}</p>
      </div>
      <div className="flex justify-center gap-2 pb-6" aria-hidden>
        {STEPS.map((_, i) => (
          <span key={i} className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-brand-500' : 'w-2 bg-white/30'}`} />
        ))}
      </div>
      <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 px-6 pb-6">
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0}>
          Précédent
        </Button>
        <Button variant="primary" size="lg" onClick={() => (last ? onDone() : setStep(step + 1))}>
          {last ? 'Commencer' : 'Suivant'}
        </Button>
      </div>
    </div>
  );
}
