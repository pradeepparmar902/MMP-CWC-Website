import { useEffect, useState } from 'react'
import CharitableTrust from './CharitableTrust'
import MatrimonyPage from './matrimony/MatrimonyPage'

const isMatrimonyRoute = () => {
  if (typeof window === 'undefined') return false
  const hash = (window.location.hash || '').toLowerCase()
  const path = (window.location.pathname || '').toLowerCase()
  const params = new URLSearchParams(window.location.search)
  return (
    hash.startsWith('#/matrimony') ||
    hash === '#matrimony' ||
    path.endsWith('/matrimony') ||
    params.get('page') === 'matrimony'
  )
}

function App() {
  const [showMatrimony, setShowMatrimony] = useState(isMatrimonyRoute)

  useEffect(() => {
    const syncRoute = () => setShowMatrimony(isMatrimonyRoute())
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  const handleBackToMain = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('page')
    if (url.pathname.toLowerCase().endsWith('/matrimony')) {
      url.pathname = url.pathname.replace(/\/matrimony$/i, '/')
    }
    url.hash = ''
    window.history.pushState({}, '', url.toString())
    setShowMatrimony(false)
  }

  if (showMatrimony) {
    return <MatrimonyPage onBack={handleBackToMain} />
  }

  return (
    <>
      <CharitableTrust />
    </>
  )
}

export default App
