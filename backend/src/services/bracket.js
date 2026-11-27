
function createSeedOrder(size) {
    let order = [1, 2];

    while (order.length < size) {
        const nextSize = order.length * 2;

        order = order.flatMap((seed) => [
            seed,
            nextSize + 1 - seed,
        ]);
    }

    return order;
}

function getRoundTitle(bracketSize, roundNumber) {
    const teams = bracketSize / Math.pow(2, roundNumber - 1);

    if (teams === 2) return 'Финал';
    if (teams === 4) return 'Полуфинал';
    if (teams === 8) return 'Четвертьфинал';

    return `1/${teams / 2} финала`;
}

// Получение сетки
function getBracket(db, tournamentId) {
    const rows = db.prepare(`
    SELECT
      m.id,
      m.round_number,
      m.match_number,
      m.participant1_id,
      m.participant2_id,
      m.winner_id,
      m.score1,
      m.score2,
      m.status,
      m.match_date,
      m.participant1_manual,
      m.participant2_manual,

      p1.name AS participant1_name,
      p2.name AS participant2_name,
      pw.name AS winner_name

    FROM matches m

    LEFT JOIN participants p1
      ON p1.id = m.participant1_id

    LEFT JOIN participants p2
      ON p2.id = m.participant2_id

    LEFT JOIN participants pw
      ON pw.id = m.winner_id

    WHERE m.tournament_id = ?

    ORDER BY m.round_number, m.match_number
  `).all(tournamentId);

    if (rows.length === 0) {
        return {
            bracketSize: 0,
            rounds: [],
        };
    }

    const roundMap = new Map();

    for (const row of rows) {
        if (!roundMap.has(row.round_number)) {
            roundMap.set(row.round_number, []);
        }

        roundMap.get(row.round_number).push({
            id: row.id,
            matchNumber: row.match_number,

            participant1: row.participant1_id === null
                ? null
                : {
                    id: row.participant1_id,
                    name: row.participant1_name,
                },

            participant2: row.participant2_id === null
                ? null
                : {
                    id: row.participant2_id,
                    name: row.participant2_name,
                },

            winner: row.winner_id === null
                ? null
                : {
                    id: row.winner_id,
                    name: row.winner_name,
                },

            participant1Manual: Boolean(row.participant1_manual),
            participant2Manual: Boolean(row.participant2_manual),

            matchDate: row.match_date,
            score1: row.score1,
            score2: row.score2,
            status: row.status,
        });
    }

    const roundNumbers = [...roundMap.keys()].sort((a, b) => a - b);
    const bracketSize = Math.pow(2, roundNumbers.length);

    const rounds = roundNumbers.map((roundNumber) => ({
        roundNumber,
        title: getRoundTitle(bracketSize, roundNumber),
        matches: roundMap.get(roundNumber),
    }));

    return { bracketSize, rounds };
}

// Пересчёт автоматического продвижения победителей
function rebuildAfterRound(db, tournamentId, startRound) {
    const result = db.prepare(`
    SELECT MAX(round_number) AS maxRound
    FROM matches
    WHERE tournament_id = ?
  `).get(tournamentId);

    const maxRound = result.maxRound;

    if (!maxRound) return;

    // Очищаем автоматические места и старые результаты
    // в последующих раундах, но сохраняем ручные назначения.
    db.prepare(`
    UPDATE matches
    SET
      participant1_id = CASE
        WHEN participant1_manual = 0 THEN NULL
        ELSE participant1_id
      END,

      participant2_id = CASE
        WHEN participant2_manual = 0 THEN NULL
        ELSE participant2_id
      END,

      winner_id = NULL,
      score1 = NULL,
      score2 = NULL,
      status = 'pending'

    WHERE tournament_id = ?
      AND round_number > ?
  `).run(tournamentId, startRound);

    // Передаём победителей в следующие раунды
    for (let round = startRound; round < maxRound; round++) {
        const winners = db.prepare(`
      SELECT match_number, winner_id, status
      FROM matches
      WHERE tournament_id = ?
        AND round_number = ?
    `).all(tournamentId, round);

        for (const match of winners) {
            if (
                !match.winner_id ||
                !['completed', 'bye'].includes(match.status)
            ) {
                continue;
            }

            const nextMatchNumber = Math.ceil(match.match_number / 2);
            const nextSlot = match.match_number % 2 === 1 ? 1 : 2;

            const target = db.prepare(`
        SELECT participant1_manual, participant2_manual
        FROM matches
        WHERE tournament_id = ?
          AND round_number = ?
          AND match_number = ?
      `).get(tournamentId, round + 1, nextMatchNumber);

            if (!target) continue;

            const manual = nextSlot === 1
                ? target.participant1_manual
                : target.participant2_manual;

            if (manual) continue;

            if (nextSlot === 1) {
                db.prepare(`
          UPDATE matches
          SET participant1_id = ?
          WHERE tournament_id = ?
            AND round_number = ?
            AND match_number = ?
        `).run(
                    match.winner_id,
                    tournamentId,
                    round + 1,
                    nextMatchNumber
                );
            } else {
                db.prepare(`
          UPDATE matches
          SET participant2_id = ?
          WHERE tournament_id = ?
            AND round_number = ?
            AND match_number = ?
        `).run(
                    match.winner_id,
                    tournamentId,
                    round + 1,
                    nextMatchNumber
                );
            }
        }

        // Определяем свободные проходы следующего раунда
        const nextMatches = db.prepare(`
      SELECT id, participant1_id, participant2_id
      FROM matches
      WHERE tournament_id = ?
        AND round_number = ?
    `).all(tournamentId, round + 1);

        for (const match of nextMatches) {
            const first = match.participant1_id;
            const second = match.participant2_id;

            let status = 'pending';
            let winner = null;

            if (first === null && second === null) {
                status = 'empty';
            } else if (first === null || second === null) {
                status = 'bye';
                winner = first ?? second;
            }

            db.prepare(`
        UPDATE matches
        SET status = ?, winner_id = ?, score1 = NULL, score2 = NULL
        WHERE id = ?
      `).run(status, winner, match.id);
        }
    }
}

// Генерация сетки
function generateBracket(db, tournamentId) {
    const participants = db.prepare(`
    SELECT id, name
    FROM participants
    WHERE tournament_id = ?
    ORDER BY position
  `).all(tournamentId);

    if (participants.length < 2) {
        throw new Error('Для генерации необходимо минимум 2 участника');
    }

    const bracketSize = Math.pow(
        2,
        Math.ceil(Math.log2(participants.length))
    );

    const roundsCount = Math.log2(bracketSize);
    const seedOrder = createSeedOrder(bracketSize);

    const slots = Array(bracketSize).fill(null);

    participants.forEach((participant, index) => {
        slots[seedOrder.indexOf(index + 1)] = participant.id;
    });

    const insertMatch = db.prepare(`
    INSERT INTO matches (
      tournament_id,
      round_number,
      match_number,
      participant1_id,
      participant2_id,
      winner_id,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

    const build = db.transaction(() => {
        db.prepare(`
      DELETE FROM matches WHERE tournament_id = ?
    `).run(tournamentId);

        for (let round = 1; round <= roundsCount; round++) {
            const matchCount = bracketSize / Math.pow(2, round);

            for (let match = 1; match <= matchCount; match++) {
                let player1 = null;
                let player2 = null;
                let winner = null;
                let status = 'empty';

                if (round === 1) {
                    player1 = slots[(match - 1) * 2];
                    player2 = slots[(match - 1) * 2 + 1];

                    if (player1 !== null && player2 !== null) {
                        status = 'pending';
                    } else if (player1 !== null || player2 !== null) {
                        status = 'bye';
                        winner = player1 ?? player2;
                    }
                }

                insertMatch.run(
                    tournamentId,
                    round,
                    match,
                    player1,
                    player2,
                    winner,
                    status
                );
            }
        }
    });

    build();

    rebuildAfterRound(db, tournamentId, 1);

    return getBracket(db, tournamentId);
}

module.exports = {
    generateBracket,
    getBracket,
    rebuildAfterRound,
};
