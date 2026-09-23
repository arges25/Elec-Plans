import opencvUrl from '@techstark/opencv-js/dist/opencv.js?url';

/**
 * Chargement paresseux d'OpenCV.js (≈ 10 Mo). Le fichier n'est téléchargé qu'à la première
 * utilisation (détection de croquis / de bords) puis mis en cache par le service worker.
 *
 * Le script est chargé tel quel (balise <script>, fichier non ré-empaqueté) : son enveloppe UMD
 * définit `globalThis.cv` (promesse du module Emscripten). On évite ainsi l'interopérabilité
 * CommonJS du bundler, incompatible avec un module qui exporte une promesse.
 */
export type OpenCv = typeof import('@techstark/opencv-js');

interface OpenCvModuleShape {
  Mat?: unknown;
  then?: unknown;
  onRuntimeInitialized?: () => void;
}

let cvPromise: Promise<OpenCv> | null = null;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Téléchargement d’OpenCV.js impossible'));
    document.head.appendChild(s);
  });
}

export function loadOpenCv(): Promise<OpenCv> {
  if (!cvPromise) {
    cvPromise = (async () => {
      const g = globalThis as { cv?: unknown };
      if (!g.cv) await injectScript(opencvUrl);
      let cv = g.cv as OpenCvModuleShape | undefined;
      if (!cv) throw new Error('OpenCV.js non initialisé');
      if (cv instanceof Promise) {
        cv = (await cv) as OpenCvModuleShape;
      } else if (!cv.Mat) {
        const pending = cv;
        await new Promise<void>((resolve) => {
          pending.onRuntimeInitialized = () => resolve();
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
