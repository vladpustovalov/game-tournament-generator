
function getTournamentStatistics(db, tournamentId) {
    // Получаем информацию о турнире
    const tournament = db.prepare(`
    SELECT
      id,
      title,
      game,
      date,
      status,
      participants_count AS maxParticipants
    FROM tournaments
    WHERE id = ?
  `).get(tournamentId);

    if (!tournament) {
        return null;
    }

    // Получаем участников
    const participants = db.prepare(`
    SELECT id, name
    FROM participants
    WHERE tournament_id = ?
    ORDER BY position
  `).all(tournamentId);

    // Получаем матчи турнира
    const matches = db.prepare(`
    SELECT
      round_number,
      participant1_id,
      participant2_id,
      winner_id,
      status
    FROM matches
    WHERE tournament_id = ?
    ORDER BY round_number, match_number
  `).all(tournamentId);

    // Инициализируем статистику каждого участника
    const playerStats = new Map();

    participants.forEach((player) => {
        playerStats.set(player.id, {
            id: player.id,
            name: player.name,
            wins: 0,
            losses: 0,
            matchesPlayed: 0,
            winPercentage: 0,
        });
    });

    let matchesPlayed = 0;
    let matchesPending = 0;
    let byeCount = 0;

    // Обрабатываем результаты матчей
    for (const match of matches) {
        if (match.status === 'bye') {
            byeCount++;
            continue;
        }

        if (
            match.status === 'completed' &&
            match.participant1_id !== null &&
            match.participant2_id !== null &&
            match.winner_id !== null
        ) {
            const winner = playerStats.get(match.winner_id);

            const loserId =
                match.winner_id === match.participant1_id
                    ? match.participant2_id
                    : match.winner_id === match.participant2_id
                        ? match.participant1_id
                        : null;

            const loser = loserId === null
                ? null
                : playerStats.get(loserId);

            // Учитываем только корректный результат
            if (!winner || !loser) continue;

            winner.wins++;
            winner.matchesPlayed++;

            loser.losses++;
            loser.matchesPlayed++;

            matchesPlayed++;
        } else if (
            match.status === 'pending' &&
            match.participant1_id !== null &&
            match.participant2_id !== null
        ) {
            matchesPending++;
        }
    }

    // Рассчитываем процент побед
    const leaderboard = [...playerStats.values()]
        .map((player) => ({
            ...player,
            winPercentage: player.matchesPlayed > 0
                ? Math.round(
                    (player.wins / player.matchesPlayed) * 100
                )
                : 0,
        }))
        .sort((a, b) =>
            b.wins - a.wins ||
            b.winPercentage - a.winPercentage ||
            a.losses - b.losses
        );

    // Количество раундов
    const roundsCount = matches.reduce(
        (max, match) => Math.max(max, match.round_number),
        0
    );

    // Общее число матчей, необходимое для определения победителя
    // В Single Elimination: количество участников минус один.
    const matchesRequired = Math.max(
        0,
        participants.length - 1
    );

    const matchesRemaining = Math.max(
        0,
        matchesRequired - matchesPlayed
    );

    const completionPercentage = matchesRequired > 0
        ? Math.round((matchesPlayed / matchesRequired) * 100)
        : 0;

    // Определяем победителя только по завершённому финалу
    let champion = null;

    if (roundsCount > 0) {
        const finalMatch = matches.find(
            (match) =>
                match.round_number === roundsCount &&
                match.status === 'completed' &&
                match.winner_id !== null
        );

        if (finalMatch) {
            champion = participants.find(
                (player) => player.id === finalMatch.winner_id
            ) ?? null;
        }
    }

    return {
        tournament: {
            ...tournament,
            participantsCount: participants.length,
        },

        summary: {
            totalParticipants: participants.length,
            matchesRequired,
            matchesPlayed,
            matchesPending,
            matchesRemaining,
            roundsCount,
            byeCount,
            completionPercentage,
            totalWins: matchesPlayed,
            totalLosses: matchesPlayed,
            champion,
        },

        participants: leaderboard,
    };
}

module.exports = {
    getTournamentStatistics,
};
