import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>,
  )
} catch (error) {
  document.body.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
    <h1>Runtime Error</h1>
    <pre>${error.stack}</pre>
  </div>`;
}
