import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import OnboardingProvider from './onboarding/OnboardingProvider'

function Layout() {
  return (
    <OnboardingProvider>
      <div className="app-shell">
        <Navbar />
        <main className="main-content" id="main-content">
          <Outlet />
        </main>
        <Footer />
      </div>
    </OnboardingProvider>
  )
}

export default Layout
