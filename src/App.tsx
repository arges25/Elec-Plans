import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { Loader2 } from 'lucide-react';
import { DialogHost } from './components/ui/DialogHost';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Toaster } from './components/ui/Toaster';
import { PwaUpdater } from './pwa/PwaUpdater';
import { HomePage } from './pages/HomePage';

const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const NewProjectPage = lazy(() => import('./pages/NewProjectPage'));
const ProjectRedirect = lazy(() => import('./pages/ProjectRedirect'));
const ImportPlanPage = lazy(() => import('./pages/ImportPlanPage'));
const ScannerPage = lazy(() => import('./pages/ScannerPage'));
const SketchToPlanPage = lazy(() => import('./pages/SketchToPlanPage'));
const PlanEditorPage = lazy(() => import('./pages/PlanEditorPage'));
const SymbolLibraryPage = lazy(() => import('./pages/SymbolLibraryPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const ProjectPanelRedirect = lazy(() => import('./pages/ProjectPanelRedirect'));
const ElectricalPanelPage = lazy(() => import('./pages/ElectricalPanelPage'));
const LabelsHomePage = lazy(() => import('./pages/LabelsHomePage'));
const LabelsPage = lazy(() => import('./pages/LabelsPage'));
const LabelPreviewPage = lazy(() => import('./pages/LabelPreviewPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const TemplateEditorPage = lazy(() => import('./pages/TemplateEditorPage'));
const PrintersPage = lazy(() => import('./pages/PrintersPage'));
const PrintCalibrationPage = lazy(() => import('./pages/PrintCalibrationPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

function PageLoader() {
  return (
    <div className="flex h-dvh items-center justify-center bg-gray-50 text-gray-500" role="status">
      <Loader2 className="mr-2 size-6 animate-spin text-brand-500" aria-hidden /> Chargement…
    </div>
  );
}

export function App() {
  const location = useLocation();
  return (
    <>
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/new" element={<NewProjectPage />} />
            <Route path="/project/:projectId" element={<ProjectRedirect />} />
            <Route path="/project/:projectId/info" element={<NewProjectPage />} />
            <Route path="/project/:projectId/plan/:planId" element={<PlanEditorPage />} />
            <Route path="/project/:projectId/plan/:planId/import" element={<ImportPlanPage />} />
            <Route path="/project/:projectId/plan/:planId/scan" element={<ScannerPage />} />
            <Route path="/project/:projectId/plan/:planId/sketch" element={<SketchToPlanPage />} />
            <Route path="/project/:projectId/export" element={<ExportPage />} />
            <Route path="/project/:projectId/panel" element={<ProjectPanelRedirect />} />
            <Route path="/panel/:panelId" element={<ElectricalPanelPage />} />
            <Route path="/panel/:panelId/labels" element={<LabelsPage />} />
            <Route path="/panel/:panelId/preview" element={<LabelPreviewPage />} />
            <Route path="/library" element={<SymbolLibraryPage />} />
            <Route path="/labels" element={<LabelsHomePage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/templates/:templateId" element={<TemplateEditorPage />} />
            <Route path="/printers" element={<PrintersPage />} />
            <Route path="/calibration" element={<PrintCalibrationPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <Toaster />
      <DialogHost />
      <PwaUpdater />
    </>
  );
}
