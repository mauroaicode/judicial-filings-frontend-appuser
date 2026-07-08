import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const CHUNK_RELOAD_KEY = 'notijudicial-chunk-reload';

function removeBootLoader(): void {
  document.getElementById('app-boot')?.remove();
}

function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Ignore storage errors in restricted browsers.
  }
}

bootstrapApplication(App, appConfig)
  .then(() => {
    clearChunkReloadFlag();
    removeBootLoader();
  })
  .catch((err) => {
    console.error(err);
    removeBootLoader();
  });
