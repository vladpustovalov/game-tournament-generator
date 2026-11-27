
import { useState } from 'react';
import type { Tournament } from '../types';
import { Link } from 'react-router-dom';

interface Props {
    tournaments: Tournament[];
    onOpen: (id: string) => void;
    onDelete: (id: string) => void;
}

export default function HomePage({
    tournaments,
    onOpen,
    onDelete,
}: Props) {
    const [search, setSearch] = useState('');

    const filtered = tournaments.filter((tournament) =>
        `${tournament.title} ${tournament.game}`
            .toLowerCase()
            .includes(search.toLowerCase())
    );

    const active = tournaments.filter(
        (t) => t.status === 'В процессе'
    ).length;

    const players = tournaments.reduce(
        (sum, t) => sum + t.participantsCount, 0
    );

    const completed = tournaments.filter(
        (t) => t.status === 'Завершён'
    ).length;

    return (
        <div>
            <div className="page-heading">
                <div>
                    <div className="eyebrow">OVERVIEW</div>
                    <h1>Турниры</h1>
                    <p>Управляй своими игровыми соревнованиями</p>
                </div>

                <Link to="/create" className="primary-button">
                    + Создать турнир
                </Link>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <span>Всего турниров</span>
                    <strong>{tournaments.length}</strong>
                    <small>Создано в системе</small>
                </div>

                <div className="stat-card">
                    <span>Активные турниры</span>
                    <strong>{active}</strong>
                    <small>В процессе проведения</small>
                </div>

                <div className="stat-card">
                    <span>Участники</span>
                    <strong>{players}</strong>
                    <small>Во всех турнирах</small>
                </div>

                <div className="stat-card">
                    <span>Завершённые</span>
                    <strong>{completed}</strong>
                    <small>Завершено соревнований</small>
                </div>
            </div>

            <div className="section-heading">
                <div>
                    <h2>Все турниры</h2>
                    <p>Список доступных соревнований</p>
                </div>

                <input
                    className="search-input"
                    placeholder="Поиск турнира..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="tournament-grid">
                {filtered.map((tournament) => (
                    <div className="tournament-card" key={tournament.id}>
                        <div className="card-top">
                            <span className="game-label">{tournament.game}</span>

                            <span className={`status ${tournament.status === 'В процессе'
                                ? 'status-active'
                                : tournament.status === 'Завершён'
                                    ? 'status-done'
                                    : 'status-planned'}`}>
                                {tournament.status}
                            </span>
                        </div>

                        <h3>{tournament.title}</h3>

                        <div className="tournament-info">
                            <span>Участников</span>
                            <strong>{tournament.participantsCount}</strong>
                        </div>

                        <div className="tournament-info">
                            <span>Дата создания</span>
                            <strong>{tournament.date}</strong>
                        </div>

                        <div className="card-actions">
                            <button
                                className="secondary-button"
                                onClick={() => onOpen(tournament.id)}
                            >
                                Открыть →
                            </button>

                            <button
                                className="delete-button"
                                onClick={() => onDelete(tournament.id)}
                            >
                                Удалить
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div className="empty-state">
                    Турниры не найдены.
                </div>
            )}
        </div>
    );
}
