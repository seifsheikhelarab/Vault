import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { bind } from 'cuelume'
import './styles.css'

const router = createRouter({
  routeTree,
  scrollRestoration: true,
  // View Transitions API: wrap navigations in startViewTransition when supported
  defaultPreloadDelay: 200,
})

// Intercept navigation to trigger View Transitions API
const originalNavigate = router.navigate.bind(router)
router.navigate = (opts: any) => {
  if (document.startViewTransition) {
    return document.startViewTransition(() => originalNavigate(opts)).finished
  }
  return originalNavigate(opts)
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient()

function App() {
  useEffect(() => { bind() }, [])
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
