import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: 40, fontFamily: "sans-serif", color: "#333"}}>
          <h1 style={{color: "red"}}>Something went wrong.</h1>
          <pre style={{background: "#f4f4f4", padding: 20, overflow: "auto", fontSize: 14}}>
            {this.state.error?.stack || this.state.error?.toString()}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

fetch('./config.json')
  .then(res => res.text())
  .then(text => {
    try {
      return text ? JSON.parse(text) : {};
    } catch(e) {
      return {};
    }
  })
  .then(async config => {
    const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const envBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;

    const mergedConfig = {
      apiKey: (envApiKey && envApiKey.trim()) || config.apiKey || "",
      projectId: (envProjectId && envProjectId.trim()) || config.projectId || "",
      bucket: (envBucket && envBucket.trim()) || config.bucket || ""
    };

    window.FIREBASE_CONFIG = mergedConfig;
    const { default: App } = await import('./App.jsx');
    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
  })
  .catch(err => {
    document.getElementById('root').innerHTML = `
      <div style="padding: 40px; font-family: sans-serif; color: #333;">
        <h1 style="color: red;">Configuration Error</h1>
        <p>Failed to load /config.json. Please ensure the file exists and is valid JSON.</p>
        <pre style="background: #f4f4f4; padding: 20px;">${err.message}</pre>
      </div>
    `;
  });
