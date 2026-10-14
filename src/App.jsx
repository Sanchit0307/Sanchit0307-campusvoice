import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import IdeasPage from './pages/IdeasPage'
import IdeaDetailPage from './pages/IdeaDetailPage'
import SubmitIdeaPage from './pages/SubmitIdeaPage'
import DashboardPage from './pages/DashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="ideas" element={<IdeasPage />} />
          <Route path="ideas/:id" element={<IdeaDetailPage />} />
          <Route path="submit" element={<SubmitIdeaPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="moderation" element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
