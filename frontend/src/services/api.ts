import type {
    Tournament,
    CreateTournamentData,
    BracketData,
    TournamentStatistics,
} from '../types';

const API_URL = '/api';

async function request<T>(
    path: string,
    options?: RequestInit
): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, options);

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Ошибка сервера: ${response.status}`);
    }

    if (response.status === 204) {
        return undefined as T;
    }

    return response.json() as Promise<T>;
}

// Получение турниров
export function getTournaments() {
    return request<Tournament[]>('/tournaments');
}

// Создание турнира
export function createTournament(data: CreateTournamentData) {
    return request<Tournament>('/tournaments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

// Удаление турнира
export function deleteTournament(id: string) {
    return request<void>(`/tournaments/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
}

// Добавление участника
export function addParticipant(tournamentId: string, name: string) {
    return request<Tournament>(
        `/tournaments/${encodeURIComponent(tournamentId)}/participants`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name }),
        }
    );
}

// Удаление участника
export function removeParticipant(
    tournamentId: string,
    participantId: number
) {
    return request<Tournament>(
        `/tournaments/${encodeURIComponent(tournamentId)}/participants/${participantId}`,
        {
            method: 'DELETE',
        }
    );
}




// Изменение порядка участников
export function reorderParticipants(
    tournamentId: string,
    participantIds: number[]
) {
    return request<Tournament>(
        `/tournaments/${encodeURIComponent(tournamentId)}/participants/reorder`,
        {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ participantIds }),
        }
    );
}


// Получение существующей сетки
export function getBracket(tournamentId: string) {
    return request<BracketData>(
        `/tournaments/${encodeURIComponent(tournamentId)}/bracket`
    );
}

// Генерация сетки
export function generateBracket(tournamentId: string) {
    return request<BracketData>(
        `/tournaments/${encodeURIComponent(tournamentId)}/bracket`,
        {
            method: 'POST',
        }
    );
}


type MatchSlot = 1 | 2;

// Изменение соперника
export function updateMatchParticipant(
    matchId: number,
    slot: MatchSlot,
    participantId: number | null,
    manual: boolean = true
) {
    return request<BracketData>(`/matches/${matchId}/participant`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            slot,
            participantId,
            manual,
        }),
    });
}

// Изменение даты
export function updateMatchDate(
    matchId: number,
    matchDate: string | null
) {
    return request<BracketData>(`/matches/${matchId}/date`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ matchDate }),
    });
}

// Выбор победителя
export function setMatchWinner(
    matchId: number,
    winnerId: number
) {
    return request<BracketData>(`/matches/${matchId}/winner`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ winnerId }),
    });
}



// Получение статистики выбранного турнира
export function getTournamentStatistics(tournamentId: string) {
    return request<TournamentStatistics>(
        `/tournaments/${encodeURIComponent(tournamentId)}/statistics`
    );
}
