
import { useEffect, useState } from 'react';

import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';

import type { Tournament, CreateTournamentData } from './types';

import {
  getTournaments,
  createTournament,
  deleteTournament,
  addParticipant,
  removeParticipant,
  reorderParticipants,
} from './services/api';

import HomePage from './pages/HomePage';
import CreateTournamentPage from './pages/CreateTournamentPage';
import TournamentPage from './pages/TournamentPage';
import StatisticsPage from './pages/StatisticsPage';

import './App.css';

function AppLayout() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  // Загружаем турниры из SQLite через backend
  useEffect(() => {
    let cancelled = false;

    getTournaments()
      .then((data) => {
        if (!cancelled) setTournaments(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Создание турнира в базе данных
  async function handleCreate(data: CreateTournamentData) {
    try {
      const newTournament = await createTournament(data);

      setTournaments((previous) => [
        newTournament,
        ...previous,
      ]);

      navigate(`/tournaments/${newTournament.id}`);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Ошибка создания турнира'
      );
    }
  }

  // Удаление турнира из базы данных
  async function handleDelete(id: string) {
    const tournament = tournaments.find((t) => t.id === id);

    if (!tournament) return;

    const confirmed = window.confirm(
      `Удалить турнир "${tournament.title}"?`
    );

    if (!confirmed) return;

    try {
      await deleteTournament(id);

      setTournaments((previous) =>
        previous.filter((t) => t.id !== id)
      );
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Ошибка удаления турнира'
      );
    }
  }



  // Добавление участника
  async function handleAddParticipant(
    tournamentId: string,
    name: string
  ) {
    try {
      const updatedTournament = await addParticipant(tournamentId, name);

      setTournaments((previous) =>
        previous.map((t) =>
          t.id === tournamentId ? updatedTournament : t
        )
      );
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Ошибка добавления участника'
      );
      throw err;
    }
  }

  // Удаление участника
  async function handleRemoveParticipant(
    tournamentId: string,
    participantId: number
  ) {
    try {
      const updatedTournament = await removeParticipant(
        tournamentId,
        participantId
      );

      setTournaments((previous) =>
        previous.map((t) =>
          t.id === tournamentId ? updatedTournament : t
        )
      );
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : 'Ошибка удаления участника'
      );
      throw err;
    }
  }

  // Изменение порядка участников
  async function handleReorderParticipants(
    tournamentId: string,
    participantIds: number[]
  ) {
    try {
      const updatedTournament = await reorderParticipants(
        tournamentId,
        participantIds
      );

      setTournaments((previous) =>
        previous.map((t) =>
          t.id === tournamentId ? updatedTournament : t
        )
      );
    } catch (err) {
      window.alert(
        err instanceof Error
          ? err.message
          : 'Ошибка изменения порядка участников'
      );
      throw err;
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">B</div>
          <div>
            <strong>BRACKET<span>HUB</span></strong>
            <small>TOURNAMENT MANAGER</small>
          </div>
        </div>

        <div className="nav-caption">МЕНЮ</div>

        <nav className="sidebar-nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'nav-link active' : 'nav-link'
            }
          >
            <span className="nav-icon">⌂</span>
            Главная
          </NavLink>

          <NavLink
            to="/create"
            className={({ isActive }) =>
              isActive ? 'nav-link active' : 'nav-link'
            }
          >
            <span className="nav-icon">＋</span>
            Создать турнир
          </NavLink>

          <NavLink
            to="/statistics"
            className={({ isActive }) =>
              isActive ? 'nav-link active' : 'nav-link'
            }
          >
            <span className="nav-icon">▥</span>
            Статистика
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span className="online-dot" />
            Система готова к работе
          </div>
          <small>BRACKETHUB · MVP</small>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="topbar-label">
              GAME TOURNAMENT GENERATOR
            </span>
            <strong>Панель управления</strong>
          </div>

          <div className="user-profile">
            <div className="user-avatar">A</div>
            <span>Администратор</span>
          </div>
        </header>

        <div className="page-content">
          {loading && (
            <div className="empty-state">Загрузка турниров...</div>
          )}

          {error && (
            <div className="empty-state">
              Не удалось загрузить турниры: {error}.
              Проверь, запущен ли backend.
            </div>
          )}

          {!loading && !error && (
            <Routes>
              <Route
                path="/"
                element={
                  <HomePage
                    tournaments={tournaments}
                    onOpen={(id) => navigate(`/tournaments/${id}`)}
                    onDelete={handleDelete}
                  />
                }
              />

              <Route
                path="/create"
                element={
                  <CreateTournamentPage onCreate={handleCreate} />
                }
              />

              <Route
                path="/tournaments/:id"
                element={
                  <TournamentPage
                    tournaments={tournaments}
                    onAddParticipant={handleAddParticipant}
                    onDeleteParticipant={handleRemoveParticipant}
                    onReorderParticipants={handleReorderParticipants}
                  />
                }
              />

              <Route
                path="/statistics"
                element={<StatisticsPage />}
              />

              <Route
                path="*"
                element={<div className="empty-state">Страница не найдена</div>}
              />
            </Routes>
          )}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
