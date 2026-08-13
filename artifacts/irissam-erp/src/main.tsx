import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

/**
 * Auto-récupération après un déploiement.
 *
 * Les pages sont chargées en lazy (chunks avec hash dans le nom). Après une
 * mise en production, un onglet resté ouvert (PWA iOS notamment) référence
 * encore les ANCIENS hashes : le serveur répond 404 sur le chunk et Vite
 * émet l'événement `vite:preloadError`. Sans traitement, la page affiche
 * l'écran d'erreur et « Réessayer » ne peut rien récupérer.
 *
 * On recharge alors la page UNE fois : la navigation repasse par le réseau
 * (service worker network-first pour le HTML) et récupère le nouvel
 * index.html avec les nouveaux hashes. Garde anti-boucle en sessionStorage
 * (si un 2e échec survient dans les 15 s, on laisse l'erreur remonter au
 * PageErrorBoundary au lieu de boucler).
 */
const CHUNK_RELOAD_KEY = 'irissam_chunk_reload_at';
window.addEventListener('vite:preloadError', (event: Event) => {
  const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - last < 15000) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(<App />);
