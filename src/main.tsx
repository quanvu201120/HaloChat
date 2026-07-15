import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'

// Inject global error handler to debug white screen
window.addEventListener('error', (event) => {
  const errorScreen = document.createElement('div');
  errorScreen.style.cssText = 'padding: 20px; color: #ff8080; background: #1e1e1e; width: 100vw; height: 100vh; font-family: monospace; z-index: 999999; position: fixed; top: 0; left: 0; overflow: auto;';

  const title = document.createElement('h2');
  title.textContent = 'Global Error Caught';

  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.wordBreak = 'break-word';
  pre.textContent = event.error?.stack || event.message;

  errorScreen.appendChild(title);
  errorScreen.appendChild(pre);
  document.body.replaceChildren(errorScreen);
});

window.addEventListener('unhandledrejection', (event) => {
  const errorScreen = document.createElement('div');
  errorScreen.style.cssText = 'padding: 20px; color: #ff8080; background: #1e1e1e; width: 100vw; height: 100vh; font-family: monospace; z-index: 999999; position: fixed; top: 0; left: 0; overflow: auto;';

  const title = document.createElement('h2');
  title.textContent = 'Unhandled Promise Rejection';

  const pre = document.createElement('pre');
  pre.style.whiteSpace = 'pre-wrap';
  pre.style.wordBreak = 'break-word';
  pre.textContent = event.reason?.stack || event.reason;

  errorScreen.appendChild(title);
  errorScreen.appendChild(pre);
  document.body.replaceChildren(errorScreen);
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
