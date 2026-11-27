
export type TournamentStatus =
    | 'В процессе'
    | 'Запланирован'
    | 'Завершён';

export interface Participant {
    id: number;
    name: string;
}

export interface Tournament {
    id: string;
    title: string;
    game: string;
    date: string;
    participantsCount: number;
    maxParticipants: number;
    status: TournamentStatus;
    participants: Participant[];
}

export interface CreateTournamentData {
    title: string;
    game: string;
    participantsCount: number;
}


export interface BracketParticipant {
    id: number;
    name: string;
}

export interface BracketMatch {
    id: number;
    matchNumber: number;

    participant1: BracketParticipant | null;
    participant2: BracketParticipant | null;
    winner: BracketParticipant | null;

    participant1Manual: boolean;
    participant2Manual: boolean;

    matchDate: string | null;

    score1: number | null;
    score2: number | null;

    status: 'pending' | 'bye' | 'completed' | 'empty';
}

export interface BracketRound {
    roundNumber: number;
    title: string;
    matches: BracketMatch[];
}

export interface BracketData {
    bracketSize: number;
    rounds: BracketRound[];
}


export interface BracketRound {
    roundNumber: number;
    title: string;
    matches: BracketMatch[];
}

export interface BracketData {
    bracketSize: number;
    rounds: BracketRound[];
}



export interface ParticipantStatistics {
    id: number;
    name: string;
    wins: number;
    losses: number;
    matchesPlayed: number;
    winPercentage: number;
}

export interface TournamentStatistics {
    tournament: {
        id: string;
        title: string;
        game: string;
        date: string;
        status: TournamentStatus;
        maxParticipants: number;
        participantsCount: number;
    };

    summary: {
        totalParticipants: number;
        matchesRequired: number;
        matchesPlayed: number;
        matchesPending: number;
        matchesRemaining: number;
        roundsCount: number;
        byeCount: number;
        completionPercentage: number;
        totalWins: number;
        totalLosses: number;
        champion: {
            id: number;
            name: string;
        } | null;
    };

    participants: ParticipantStatistics[];
}
