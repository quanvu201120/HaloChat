import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'

// Inject global error handler to debug white screen
window.addEventListener('error', (event) => {
  document.body.innerHTML = `<div style="padding: 20px; color: #ff8080; background: #1e1e1e; width: 100vw; height: 100vh; font-family: monospace; z-index: 999999; position: fixed; top: 0; left: 0; overflow: auto;">
    <h2>Global Error Caught</h2>
    <pre style="white-space: pre-wrap; word-break: break-word;">${event.error?.stack || event.message}</pre>
  </div>`;
});

window.addEventListener('unhandledrejection', (event) => {
  document.body.innerHTML = `<div style="padding: 20px; color: #ff8080; background: #1e1e1e; width: 100vw; height: 100vh; font-family: monospace; z-index: 999999; position: fixed; top: 0; left: 0; overflow: auto;">
    <h2>Unhandled Promise Rejection</h2>
    <pre style="white-space: pre-wrap; word-break: break-word;">${event.reason?.stack || event.reason}</pre>
  </div>`;
});
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
