
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { Tournament, BracketData, BracketMatch } from '../types';

import {
    getBracket,
    generateBracket,
    updateMatchParticipant,
    updateMatchDate,
    setMatchWinner,
} from '../services/api';

interface Props {
    tournaments: Tournament[];

    onAddParticipant: (
        tournamentId: string,
        name: string
    ) => Promise<void>;

    onDeleteParticipant: (
        tournamentId: string,
        participantId: number
    ) => Promise<void>;

    // Оставлено для совместимости со старой версией App.tsx.
    onReorderParticipants?: (
        tournamentId: string,
        participantIds: number[]
    ) => Promise<void>;
}

const emptyBracket: BracketData = {
    bracketSize: 0,
    rounds: [],
};

export default function TournamentPage({
    tournaments,
    onAddParticipant,
    onDeleteParticipant,
}: Props) {
    const { id } = useParams();

    const tournament = tournaments.find((t) => t.id === id);
    const tournamentId = tournament?.id ?? '';

    const [participantName, setParticipantName] = useState('');
    const [saving, setSaving] = useState(false);

    const [bracket, setBracket] = useState<BracketData>(emptyBracket);
    const [bracketLoading, setBracketLoading] = useState(false);
    const [bracketError, setBracketError] = useState('');

    const [generating, setGenerating] = useState(false);
    const [workingMatchId, setWorkingMatchId] = useState<number | null>(null);

    const [dateDrafts, setDateDrafts] = useState<Record<number, string>>({});

    const participantOrderKey =
        tournament?.participants.map((p) => p.id).join(',') ?? '';

    // Получение сохранённой турнирной сетки
    useEffect(() => {
        if (!tournamentId) {
            setBracket(emptyBracket);
            return;
        }

        let cancelled = false;

        setBracketLoading(true);
        setBracketError('');

        getBracket(tournamentId)
            .then((data) => {
                if (!cancelled) setBracket(data);
            })
            .catch((error) => {
                if (!cancelled) {
                    setBracketError(
                        error instanceof Error
                            ? error.message
                            : 'Ошибка загрузки сетки'
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setBracketLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [tournamentId, participantOrderKey]);

    if (!tournament || !tournamentId) {
        return (
            <div className="empty-state">
                Турнир не найден. <Link to="/">Вернуться на главную</Link>
            </div>
        );
    }

    const players = tournament.participants;
    const isFull = players.length >= tournament.maxParticipants;

    const bracketHeight =
        Math.max(1, bracket.rounds[0]?.matches.length ?? 1) * 230;

    // Добавление игрока
    async function handleAdd(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const name = participantName.trim();

        if (!name || saving || isFull) return;

        setSaving(true);

        try {
            await onAddParticipant(tournamentId, name);
            setParticipantName('');
        } catch {
            // Ошибка отображается в App.tsx
        } finally {
            setSaving(false);
        }
    }

    // Удаление игрока
    async function handleRemove(
        participantId: number,
        name: string
    ) {
        if (!window.confirm(`Удалить участника "${name}"?`)) return;

        try {
            await onDeleteParticipant(tournamentId, participantId);
        } catch {
            // Ошибка отображается в App.tsx
        }
    }

    // Получение значения поля соперника
    function getSlotValue(
        match: BracketMatch,
        slot: 1 | 2
    ) {
        const player = slot === 1
            ? match.participant1
            : match.participant2;

        const manual = slot === 1
            ? match.participant1Manual
            : match.participant2Manual;

        if (player) return String(player.id);

        return manual ? '' : '__auto__';
    }

    // Изменение соперника непосредственно в матче
    async function handleSlotChange(
        match: BracketMatch,
        slot: 1 | 2,
        value: string
    ) {
        const manual = value !== '__auto__';

        const participantId =
            value === '' || value === '__auto__'
                ? null
                : Number(value);

        setWorkingMatchId(match.id);

        try {
            const updatedBracket = await updateMatchParticipant(
                match.id,
                slot,
                participantId,
                manual
            );

            setBracket(updatedBracket);
        } catch (error) {
            window.alert(
                error instanceof Error
                    ? error.message
                    : 'Ошибка изменения участника'
            );
        } finally {
            setWorkingMatchId(null);
        }
    }

    // Сохранение даты матча
    async function handleSaveDate(match: BracketMatch) {
        const date = dateDrafts[match.id] ?? match.matchDate ?? '';

        if (date === (match.matchDate ?? '')) return;

        setWorkingMatchId(match.id);

        try {
            const updatedBracket = await updateMatchDate(
                match.id,
                date || null
            );

            setBracket(updatedBracket);

            setDateDrafts((previous) => {
                const updated = { ...previous };
                delete updated[match.id];
                return updated;
            });
        } catch (error) {
            window.alert(
                error instanceof Error
                    ? error.message
                    : 'Ошибка сохранения даты'
            );
        } finally {
            setWorkingMatchId(null);
        }
    }

    // Выбор победителя
    async function handleWinner(match: BracketMatch, winnerId: number, name: string) {
        if (workingMatchId !== null) return;

        if (
            match.winner &&
            match.winner.id !== winnerId &&
            !window.confirm(
                `Изменить победителя на ${name}? Результаты последующих раундов будут пересчитаны.`
            )
        ) {
            return;
        }

        setWorkingMatchId(match.id);

        try {
            const updatedBracket = await setMatchWinner(
                match.id,
                winnerId
            );

            setBracket(updatedBracket);
        } catch (error) {
            window.alert(
                error instanceof Error
                    ? error.message
                    : 'Ошибка сохранения победителя'
            );
        } finally {
            setWorkingMatchId(null);
        }
    }

    // Генерация или пересоздание сетки
    async function handleGenerateBracket() {
        if (players.length < 2 || generating) return;

        if (
            bracket.rounds.length > 0 &&
            !window.confirm(
                'Пересоздать сетку? Все текущие назначения и даты матчей будут сброшены.'
            )
        ) {
            return;
        }

        setGenerating(true);
        setBracketError('');

        try {
            const result = await generateBracket(tournamentId);
            setBracket(result);
            setDateDrafts({});
        } catch (error) {
            setBracketError(
                error instanceof Error
                    ? error.message
                    : 'Ошибка генерации сетки'
            );
        } finally {
            setGenerating(false);
        }
    }

    return (
        <div>
            <Link to="/" className="back-link">
                ← Все турниры
            </Link>

            <div className="page-heading tournament-heading">
                <div>
                    <div className="eyebrow">{tournament.game}</div>
                    <h1>{tournament.title}</h1>
                    <p>Турнирная сетка и список участников</p>
                </div>

                <span className="status status-active">
                    {tournament.status}
                </span>
            </div>

            <div className="detail-grid">

                {/* ТУРНИРНАЯ СЕТКА */}

                <section className="panel bracket-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Турнирная сетка</h2>
                            <p>Формат: Single Elimination</p>
                        </div>

                        <div className="bracket-header-actions">
                            <span className="game-label">
                                {players.length}/{tournament.maxParticipants} игроков
                            </span>

                            <button
                                className="primary-button generate-bracket-button"
                                onClick={handleGenerateBracket}
                                disabled={
                                    players.length < 2 ||
                                    generating ||
                                    bracketLoading
                                }
                            >
                                {generating
                                    ? 'Генерация...'
                                    : bracket.rounds.length > 0
                                        ? 'Пересоздать сетку'
                                        : 'Сгенерировать сетку'}
                            </button>
                        </div>
                    </div>

                    {bracketLoading ? (
                        <div className="bracket-empty">
                            Загрузка турнирной сетки...
                        </div>
                    ) : bracketError ? (
                        <div className="bracket-error">
                            {bracketError}
                        </div>
                    ) : bracket.rounds.length > 0 ? (
                        <div className="bracket-scroll">
                            <div
                                className="bracket-rounds"
                                style={{ minHeight: `${bracketHeight}px` }}
                            >
                                {bracket.rounds.map((round) => (
                                    <div
                                        className="bracket-round"
                                        key={round.roundNumber}
                                    >
                                        <h3>{round.title}</h3>

                                        <div className="matches-list">
                                            {round.matches.map((match) => (
                                                <div
                                                    className="match-card"
                                                    key={match.id}
                                                >
                                                    <div className="match-number">
                                                        MATCH {round.roundNumber}.{match.matchNumber}
                                                    </div>

                                                    {/* РЕДАКТИРОВАНИЕ СОПЕРНИКОВ */}

                                                    <div className="match-editor">
                                                        <label className="match-slot-label">
                                                            Участник 1

                                                            <select
                                                                className="match-player-select"
                                                                value={getSlotValue(match, 1)}
                                                                disabled={workingMatchId === match.id}
                                                                onChange={(e) =>
                                                                    handleSlotChange(
                                                                        match,
                                                                        1,
                                                                        e.target.value
                                                                    )
                                                                }
                                                            >
                                                                <option value="__auto__">
                                                                    Автоматически
                                                                </option>

                                                                <option value="">
                                                                    Пустое место
                                                                </option>

                                                                {players.map((player) => (
                                                                    <option
                                                                        key={player.id}
                                                                        value={String(player.id)}
                                                                    >
                                                                        {player.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>

                                                        <label className="match-slot-label">
                                                            Участник 2

                                                            <select
                                                                className="match-player-select"
                                                                value={getSlotValue(match, 2)}
                                                                disabled={workingMatchId === match.id}
                                                                onChange={(e) =>
                                                                    handleSlotChange(
                                                                        match,
                                                                        2,
                                                                        e.target.value
                                                                    )
                                                                }
                                                            >
                                                                <option value="__auto__">
                                                                    Автоматически
                                                                </option>

                                                                <option value="">
                                                                    Пустое место
                                                                </option>

                                                                {players.map((player) => (
                                                                    <option
                                                                        key={player.id}
                                                                        value={String(player.id)}
                                                                    >
                                                                        {player.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>

                                                    {/* ДАТА МАТЧА */}

                                                    <div className="match-date-editor">
                                                        <label>
                                                            Дата и время

                                                            <input
                                                                type="datetime-local"
                                                                className="match-date-input"
                                                                value={
                                                                    dateDrafts[match.id] ??
                                                                    match.matchDate ??
                                                                    ''
                                                                }
                                                                disabled={workingMatchId === match.id}
                                                                onChange={(e) =>
                                                                    setDateDrafts((previous) => ({
                                                                        ...previous,
                                                                        [match.id]: e.target.value,
                                                                    }))
                                                                }
                                                            />
                                                        </label>

                                                        {dateDrafts[match.id] !== undefined && (
                                                            <button
                                                                type="button"
                                                                className="save-date-button"
                                                                disabled={workingMatchId === match.id}
                                                                onClick={() => handleSaveDate(match)}
                                                            >
                                                                Сохранить дату
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* ВЫБОР ПОБЕДИТЕЛЯ */}

                                                    <div className="match-result">
                                                        {match.status === 'bye' && match.winner ? (
                                                            <div className="bye-result">
                                                                BYE — проходит: {match.winner.name}
                                                            </div>
                                                        ) : match.participant1 && match.participant2 ? (
                                                            <>
                                                                <div className="winner-caption">
                                                                    Выбрать победителя:
                                                                </div>


                                                                <div className="winner-options">
                                                                    <div className="winner-option">
                                                                        <span>{match.participant1.name}</span>

                                                                        <button
                                                                            type="button"
                                                                            className={
                                                                                match.winner?.id === match.participant1.id
                                                                                    ? 'winner-select-button selected-winner'
                                                                                    : 'winner-select-button'
                                                                            }
                                                                            disabled={workingMatchId === match.id}
                                                                            onClick={() =>
                                                                                handleWinner(
                                                                                    match,
                                                                                    match.participant1!.id,
                                                                                    match.participant1!.name
                                                                                )
                                                                            }
                                                                        >
                                                                            {match.winner?.id === match.participant1.id
                                                                                ? '✓ Победитель'
                                                                                : 'Победил'}
                                                                        </button>
                                                                    </div>

                                                                    <div className="winner-option">
                                                                        <span>{match.participant2.name}</span>

                                                                        <button
                                                                            type="button"
                                                                            className={
                                                                                match.winner?.id === match.participant2.id
                                                                                    ? 'winner-select-button selected-winner'
                                                                                    : 'winner-select-button'
                                                                            }
                                                                            disabled={workingMatchId === match.id}
                                                                            onClick={() =>
                                                                                handleWinner(
                                                                                    match,
                                                                                    match.participant2!.id,
                                                                                    match.participant2!.name
                                                                                )
                                                                            }
                                                                        >
                                                                            {match.winner?.id === match.participant2.id
                                                                                ? '✓ Победитель'
                                                                                : 'Победил'}
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                            </>
                                                        ) : (
                                                            <div className="match-status">
                                                                {match.status === 'empty'
                                                                    ? 'Ожидает распределения участников'
                                                                    : 'Ожидает соперника'}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bracket-empty">
                            {players.length < 2
                                ? 'Добавь минимум двух участников, чтобы создать сетку.'
                                : 'Участники готовы! Нажми «Сгенерировать сетку».'}
                        </div>
                    )}
                </section>

                {/* СПИСОК УЧАСТНИКОВ */}

                <aside className="panel participants-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Участники</h2>
                            <p>Список игроков турнира</p>
                        </div>

                        <strong>
                            {players.length}/{tournament.maxParticipants}
                        </strong>
                    </div>

                    <form
                        className="participant-add-form"
                        onSubmit={handleAdd}
                    >
                        <input
                            className="participant-input"
                            type="text"
                            placeholder="Имя нового игрока"
                            value={participantName}
                            onChange={(e) => setParticipantName(e.target.value)}
                            maxLength={40}
                            disabled={isFull || saving}
                        />

                        <button
                            type="submit"
                            className="primary-button participant-add-button"
                            disabled={isFull || saving || !participantName.trim()}
                        >
                            {saving ? 'Добавление...' : '+ Добавить'}
                        </button>
                    </form>

                    {isFull && (
                        <p className="capacity-message">
                            Турнир заполнен. Достигнут лимит участников.
                        </p>
                    )}

                    <div className="participant-list">
                        {players.map((player, index) => (
                            <div className="participant-item" key={player.id}>
                                <span className="participant-avatar">
                                    {index + 1}
                                </span>

                                <span className="participant-name">
                                    {player.name}
                                </span>

                                <button
                                    type="button"
                                    className="participant-remove"
                                    title={`Удалить ${player.name}`}
                                    onClick={() => handleRemove(player.id, player.name)}
                                >
                                    ×
                                </button>
                            </div>
                        ))}

                        {players.length === 0 && (
                            <div className="participants-empty">
                                Пока нет участников. Добавь первого игрока!
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
