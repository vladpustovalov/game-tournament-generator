
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CreateTournamentData } from '../types';

interface Props {
    onCreate: (data: CreateTournamentData) => void;
}

export default function CreateTournamentPage({ onCreate }: Props) {
    const [title, setTitle] = useState('');
    const [game, setGame] = useState('VALORANT');
    const [participantsCount, setParticipantsCount] = useState(8);

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!title.trim()) return;

        if (
            !Number.isInteger(participantsCount) ||
            participantsCount < 2 ||
            participantsCount > 64
        ) {
            alert('Количество участников должно быть от 2 до 64');
            return;
        }

        onCreate({
            title: title.trim(),
            game,
            participantsCount,
        });
    }

    return (
        <div>
            <div className="page-heading">
                <div>
                    <div className="eyebrow">NEW EVENT</div>
                    <h1>Создание турнира</h1>
                    <p>Заполни информацию о новом соревновании</p>
                </div>
            </div>

            <form className="form-panel" onSubmit={handleSubmit}>
                <div className="form-section">
                    <h2>Основная информация</h2>
                    <p>Укажи название и игровую дисциплину</p>

                    <label>Название турнира</label>
                    <input
                        className="form-input"
                        type="text"
                        placeholder="Например, Summer Gaming Cup"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        maxLength={60}
                    />

                    <label>Игра</label>
                    <select
                        className="form-input"
                        value={game}
                        onChange={(e) => setGame(e.target.value)}
                    >
                        <option value="VALORANT">VALORANT</option>
                        <option value="CS2">Counter-Strike 2</option>
                        <option value="DOTA 2">Dota 2</option>
                        <option value="LEAGUE OF LEGENDS">League of Legends</option>
                        <option value="ROCKET LEAGUE">Rocket League</option>
                        <option value="OTHER">Другая игра</option>
                    </select>

                    <label>Максимальное количество участников (2–64)</label>
                    <input
                        className="form-input"
                        type="number"
                        min={2}
                        max={64}
                        step={1}
                        value={participantsCount}
                        onChange={(e) =>
                            setParticipantsCount(Number(e.target.value))
                        }
                        required
                    />
                </div>

                <div className="form-note">
                    <strong>Формат турнира: Single Elimination</strong>
                    <p>
                        Участники будут распределены по парам.
                        Победитель каждого матча проходит в следующий раунд.
                    </p>
                </div>

                <div className="form-actions">
                    <button type="submit" className="primary-button">
                        Создать турнир →
                    </button>
                </div>
            </form>
        </div>
    );
}
