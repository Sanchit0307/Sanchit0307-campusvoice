import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

function Layout() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content" id="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default Layout
