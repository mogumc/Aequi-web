import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import '@fontsource/roboto/700.css'
import App from './App'
import { ThemeModeProvider } from './contexts/ThemeModeContext'
import { ErrorBoundary } from './components/ErrorBoundary'

const { pathname, search, hash } = window.location
if (pathname.length > 1 && !pathname.endsWith('/') && hash) {
  window.location.replace(pathname + '/' + search + hash)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ThemeModeProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ThemeModeProvider>
    </HashRouter>
  </React.StrictMode>,
)
