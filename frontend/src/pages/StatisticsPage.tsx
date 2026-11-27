
import { useEffect, useState } from 'react';

import type {
    Tournament,
    TournamentStatistics,
} from '../types';

import {
    getTournaments,
    getTournamentStatistics,
} from '../services/api';

export default function StatisticsPage() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [selectedId, setSelectedId] = useState('');

    const [statistics, setStatistics] =
        useState<TournamentStatistics | null>(null);

    const [loadingList, setLoadingList] = useState(true);
    const [loadingStats, setLoadingStats] = useState(false);
    const [error, setError] = useState('');

    // Получаем список турниров
    useEffect(() => {
        let cancelled = false;

        getTournaments()
            .then((data) => {
                if (cancelled) return;

                setTournaments(data);

                if (data.length > 0) {
                    setSelectedId((previous) =>
                        data.some((t) => t.id === previous)
                            ? previous
                            : data[0].id
                    );
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Ошибка загрузки турниров'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingList(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Получаем статистику выбранного турнира
    useEffect(() => {
        if (!selectedId) {
            setStatistics(null);
            setLoadingStats(false);
            return;
        }

        let cancelled = false;

        setStatistics(null);
        setLoadingStats(true);
        setError('');

        getTournamentStatistics(selectedId)
            .then((data) => {
                if (!cancelled) setStatistics(data);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Ошибка загрузки статистики'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingStats(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    return (
        <div>
            <div className="page-heading">
                <div>
                    <div className="eyebrow">ANALYTICS</div>
                    <h1>Статистика</h1>
                    <p>Результаты и показатели участников турнира</p>
                </div>
            </div>

            {/* ВЫБОР ТУРНИРА */}

            <section className="panel statistics-selector">
                <div>
                    <h2>Выбранный турнир</h2>
                    <p>Статистика рассчитывается отдельно для каждого турнира</p>
                </div>

                <select
                    className="statistics-select"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    disabled={loadingList || tournaments.length === 0}
                >
                    {tournaments.length === 0 && (
                        <option value="">Нет турниров</option>
                    )}

                    {tournaments.map((tournament) => (
                        <option key={tournament.id} value={tournament.id}>
                            {tournament.title} — {tournament.game}
                        </option>
                    ))}
                </select>
            </section>

            {loadingList || loadingStats ? (
                <div className="empty-state">
                    Загрузка статистики...
                </div>
            ) : error ? (
                <div className="bracket-error">{error}</div>
            ) : !statistics ? (
                <div className="empty-state">
                    Создай турнир, чтобы увидеть статистику.
                </div>
            ) : (
                <>
                    {/* ОБЩИЕ ПОКАЗАТЕЛИ */}

                    <div className="stats-grid">
                        <div className="stat-card">
                            <span>Участники</span>
                            <strong>{statistics.summary.totalParticipants}</strong>
                            <small>
                                Вместимость: {statistics.tournament.maxParticipants}
                            </small>
                        </div>

                        <div className="stat-card">
                            <span>Сыграно матчей</span>
                            <strong>{statistics.summary.matchesPlayed}</strong>
                            <small>
                                Из {statistics.summary.matchesRequired} необходимых
                            </small>
                        </div>

                        <div className="stat-card">
                            <span>Ожидают проведения</span>
                            <strong>{statistics.summary.matchesPending}</strong>
                            <small>
                                Осталось матчей: {statistics.summary.matchesRemaining}
                            </small>
                        </div>

                        <div className="stat-card">
                            <span>Завершение турнира</span>
                            <strong>
                                {statistics.summary.completionPercentage}%
                            </strong>
                            <small>
                                Раундов: {statistics.summary.roundsCount}
                            </small>
                        </div>
                    </div>

                    {/* ПРОГРЕСС */}

                    <section className="panel statistics-progress">
                        <div className="panel-heading">
                            <div>
                                <h2>Прогресс турнира</h2>
                                <p>{statistics.tournament.title}</p>
                            </div>

                            <strong>
                                {statistics.summary.completionPercentage}%
                            </strong>
                        </div>

                        <div className="statistics-progress-track">
                            <div
                                style={{
                                    width: `${statistics.summary.completionPercentage}%`,
                                }}
                            />
                        </div>

                        <div className="progress-details">
                            <span>
                                Завершено: {statistics.summary.matchesPlayed}
                            </span>

                            <span>
                                Свободных проходов BYE: {statistics.summary.byeCount}
                            </span>
                        </div>
                    </section>

                    {/* ПОБЕДИТЕЛЬ */}

                    {statistics.summary.champion && (
                        <section className="statistics-champion">
                            <div className="champion-icon">🏆</div>

                            <div>
                                <span>ПОБЕДИТЕЛЬ ТУРНИРА</span>
                                <h2>{statistics.summary.champion.name}</h2>
                                <p>{statistics.tournament.title}</p>
                            </div>
                        </section>
                    )}

                    {/* ТАБЛИЦА УЧАСТНИКОВ */}

                    <section className="panel leaderboard">
                        <div className="panel-heading">
                            <div>
                                <h2>Рейтинг участников</h2>
                                <p>Победы, поражения и процент побед</p>
                            </div>
                        </div>

                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Место</th>
                                        <th>Участник</th>
                                        <th>Победы</th>
                                        <th>Поражения</th>
                                        <th>Матчи</th>
                                        <th>Процент побед</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {statistics.participants.map((player, index) => (
                                        <tr key={player.id}>
                                            <td>
                                                <strong>#{index + 1}</strong>
                                            </td>

                                            <td>
                                                <strong>{player.name}</strong>
                                            </td>

                                            <td className="win-value">
                                                {player.wins}
                                            </td>

                                            <td>
                                                {player.losses}
                                            </td>

                                            <td>
                                                {player.matchesPlayed}
                                            </td>

                                            <td>
                                                <div className="win-rate">
                                                    <div className="rate-track">
                                                        <div
                                                            style={{
                                                                width: `${player.winPercentage}%`,
                                                            }}
                                                        />
                                                    </div>

                                                    <strong>{player.winPercentage}%</strong>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {statistics.participants.length === 0 && (
                                        <tr>
                                            <td colSpan={6}>
                                                У турнира пока нет участников.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
}
