import { useNavigate } from 'react-router';
import { FlaskConical, Lock, ShieldAlert, Smartphone } from 'lucide-react';
import { AppHeader, PageBody } from '../components/layout/AppHeader';
import { LogoMark } from '../components/layout/Logo';
import { Card, SectionTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ELECTRICAL_SYMBOLS } from '../data/electricalSymbols';

/** À propos : confidentialité, limites, fonctions expérimentales. */
export default function AboutPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh">
      <AppHeader title="À propos" back />
      <PageBody className="max-w-2xl">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <LogoMark size={96} className="rounded-3xl shadow-lg" />
          <h2 className="text-2xl font-extrabold">
            MG Elec <span className="text-brand-500">&amp;</span> Plans
          </h2>
          <p className="text-gray-600">Vos plans électriques, simplement.</p>
          <p className="text-xs text-gray-400">Version {__APP_VERSION__}</p>
        </div>

        <Card className="flex items-start gap-3 p-4">
          <Lock className="mt-0.5 size-6 shrink-0 text-green-600" aria-hidden />
          <div>
            <p className="font-bold">Vos projets sont stockés localement sur cet appareil.</p>
            <p className="mt-1 text-sm text-gray-600">
              Aucun compte, aucun suivi, aucune donnée envoyée sur internet par défaut. Pensez à exporter vos projets (.mgeplan) pour les sauvegarder ou les transférer.
            </p>
          </div>
        </Card>

        <SectionTitle>Ce que fait l’application</SectionTitle>
        <Card className="p-4 text-sm text-gray-700">
          <ul className="list-disc space-y-1 pl-5">
            <li>Import de plans (photo, scan, image, PDF) et dessin rapide des murs</li>
            <li>{ELECTRICAL_SYMBOLS.length} symboles électriques génériques, aimantés aux murs</li>
            <li>Liaisons pointillées commande / circuit / information</li>
            <li>Légende automatique, aperçu client, export PDF vectoriel</li>
            <li>Tableau électrique et étiquettes Legrand, Schneider, Hager calibrées au millimètre</li>
            <li>Fonctionne hors connexion après la première ouverture (PWA installable)</li>
          </ul>
        </Card>

        <SectionTitle>Pas de contrôle normatif</SectionTitle>
        <Card className="flex items-start gap-3 p-4">
          <ShieldAlert className="mt-0.5 size-6 shrink-0 text-brand-600" aria-hidden />
          <p className="text-sm text-gray-700">
            MG Elec &amp; Plans ne vérifie pas la conformité NF C 15-100 et n’affiche jamais « installation conforme ». Les informations saisies (circuits, protections, sections) sont
            une aide : la validation reste de la responsabilité de l’électricien.
          </p>
        </Card>

        <SectionTitle>Fonctions expérimentales</SectionTitle>
        <Card className="flex items-start gap-3 p-4">
          <FlaskConical className="mt-0.5 size-6 shrink-0 text-purple-600" aria-hidden />
          <div className="text-sm text-gray-700">
            <p>
              <strong>Croquis → Plan</strong> : reconstruction automatique locale (OpenCV.js) d’un plan simplifié. Le résultat doit être vérifié et corrigé ; aucune IA n’est
              utilisée dans cette version.
            </p>
            <p className="mt-2">
              <strong>Impression Bluetooth directe</strong> : uniquement avec Web Bluetooth (Chrome / Edge, pas Safari iOS) et des imprimantes ESC/POS compatibles. Sinon :
              impression système ou PDF.
            </p>
          </div>
        </Card>

        <SectionTitle>Installation</SectionTitle>
        <Card className="flex items-start gap-3 p-4">
          <Smartphone className="mt-0.5 size-6 shrink-0 text-gray-600" aria-hidden />
          <div className="text-sm text-gray-700">
            <p>iPhone : Safari → Partager → « Sur l’écran d’accueil » → Ajouter.</p>
            <p>Android : menu du navigateur → « Installer l’application ».</p>
            <Button size="sm" className="mt-2" onClick={() => navigate('/settings')}>
              Réglages
            </Button>
          </div>
        </Card>

        <p className="mt-6 text-center text-xs text-gray-400">
          Réalisé avec React, TypeScript, Vite, Tailwind CSS, Zustand, Dexie, Konva, PDF.js, pdf-lib, OpenCV.js et Lucide.
        </p>
      </PageBody>
    </div>
  );
}
