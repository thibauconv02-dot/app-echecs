import { useState } from 'react'
import { FreePlayScreen } from './screens/FreePlayScreen'
import { AboutScreen } from './screens/AboutScreen'
import { GamesScreen } from './screens/GamesScreen'
import { GameViewScreen } from './screens/GameViewScreen'
import { StatsScreen } from './screens/StatsScreen'
import { BatchStatus } from './components/BatchStatus'

type Tab = 'free' | 'games' | 'stats' | 'about'

const TABS: { id: Tab; label: string }[] = [
  { id: 'games', label: 'Mes parties' },
  { id: 'stats', label: 'Statistiques' },
  { id: 'free', label: 'Jeu libre' },
  { id: 'about', label: 'À propos' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('games')
  const [openGame, setOpenGame] = useState<string | null>(null)
  return (
    <div className="app">
      <nav className="tabs">
        <strong className="brand">♞ Entraîneur</strong>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => {
              setTab(t.id)
              if (t.id === 'games') setOpenGame(null)
            }}>
            {t.label}
          </button>
        ))}
        <BatchStatus />
      </nav>
      <main>
        {tab === 'games' && !openGame && <GamesScreen onOpen={setOpenGame} />}
        {tab === 'games' && openGame && <GameViewScreen gameId={openGame} onBack={() => setOpenGame(null)} />}
        {tab === 'stats' && <StatsScreen />}
        {tab === 'free' && <FreePlayScreen />}
        {tab === 'about' && <AboutScreen />}
      </main>
    </div>
  )
}
