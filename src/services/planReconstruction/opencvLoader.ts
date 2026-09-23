/**
 * Chargement paresseux d'OpenCV.js (≈ 10 Mo). Le fichier n'est téléchargé qu'à la première
 * utilisation (détection de croquis / de bords) puis mis en cache par le service worker.
 */
export type OpenCv = typeof import('@techstark/opencv-js');

let cvPromise: Promise<OpenCv> | null = null;

interface OpenCvModuleShape {
  Mat?: unknown;
  then?: unknown;
  onRuntimeInitialized?: () => void;
}

export function loadOpenCv(): Promise<OpenCv> {
  if (!cvPromise) {
    cvPromise = (async () => {
      const mod = (await import('@techstark/opencv-js')) as unknown as { default?: unknown };
      // Selon la version, le module exporte soit une promesse, soit l'objet `cv` déjà prêt,
      // soit un objet à initialiser (onRuntimeInitialized). Forme dynamique : typée localement.
      let cv = (mod.default ?? mod) as OpenCvModuleShape;
      if (typeof cv.then === 'function') {
        cv = (await (cv as unknown as Promise<OpenCvModuleShape>)) as OpenCvModuleShape;
      } else if (!cv.Mat) {
        await new Promise<void>((resolve) => {
          cv.onRuntimeInitialized = () => resolve();
        });
      }
      return cv as unknown as OpenCv;
    })().catch((err) => {
      cvPromise = null;
      throw err;
    });
  }
  return cvPromise;
}

export function isOpenCvLoaded(): boolean {
  return cvPromise !== null;
}
