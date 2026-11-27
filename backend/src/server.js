
const path = require('node:path');

const express = require('express');
const cors = require('cors');
const crypto = require('node:crypto');

const db = require('./db');

const {
  generateBracket,
  getBracket,
  rebuildAfterRound,
} = require('./services/bracket');

const {
  getTournamentStatistics,
} = require('./services/statistics');

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

// Получение турнира с участниками
function getTournament(id) {
  const tournament = db.prepare(`
    SELECT
      id,
      title,
      game,
      date,
      participants_count AS maxParticipants,
      status,
      (
        SELECT COUNT(*)
        FROM participants
        WHERE tournament_id = tournaments.id
      ) AS participantsCount
    FROM tournaments
    WHERE id = ?
  `).get(id);

  if (!tournament) return null;

  const participants = db.prepare(`
    SELECT id, name
    FROM participants
    WHERE tournament_id = ?
    ORDER BY position
  `).all(id);

  return { ...tournament, participants };
}

// Проверка сервера
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Получение списка турниров
app.get('/api/tournaments', (req, res) => {
  const rows = db.prepare(`
    SELECT id FROM tournaments ORDER BY rowid DESC
  `).all();

  res.json(rows.map(row => getTournament(row.id)));
});

// Создание турнира
app.post('/api/tournaments', (req, res) => {
  const { title, game } = req.body;
  const participantsCount = Number(req.body.participantsCount);

  if (
    typeof title !== 'string' ||
    !title.trim() ||
    typeof game !== 'string' ||
    !game.trim() ||
    !Number.isInteger(participantsCount) ||
    participantsCount < 2 ||
    participantsCount > 64
  ) {
    return res.status(400).json({
      error: 'Некорректные данные турнира'
    });
  }

  const id = crypto.randomUUID();
  const date = new Date().toLocaleDateString('ru-RU');

  db.prepare(`
    INSERT INTO tournaments
    (id, title, game, date, participants_count, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    title.trim(),
    game.trim(),
    date,
    participantsCount,
    'Запланирован'
  );

  res.status(201).json(getTournament(id));
});



// Получение статистики турнира
app.get('/api/tournaments/:id/statistics', (req, res) => {
  const statistics = getTournamentStatistics(
    db,
    req.params.id
  );

  if (!statistics) {
    return res.status(404).json({
      error: 'Турнир не найден'
    });
  }

  res.json(statistics);
});


// Получение существующей сетки
app.get('/api/tournaments/:id/bracket', (req, res) => {
  if (!getTournament(req.params.id)) {
    return res.status(404).json({
      error: 'Турнир не найден'
    });
  }

  res.json(getBracket(db, req.params.id));
});

// Генерация новой сетки
app.post('/api/tournaments/:id/bracket', (req, res) => {
  const tournament = getTournament(req.params.id);

  if (!tournament) {
    return res.status(404).json({
      error: 'Турнир не найден'
    });
  }

  if (tournament.participantsCount < 2) {
    return res.status(400).json({
      error: 'Для генерации необходимо минимум 2 участника'
    });
  }

  const existingBracket = getBracket(db, req.params.id);

  const hasCompletedMatches = existingBracket.rounds.some(
    (round) => round.matches.some(
      (match) => match.status === 'completed'
    )
  );

  if (hasCompletedMatches) {
    return res.status(409).json({
      error: 'Нельзя пересоздать сетку после завершения матчей'
    });
  }

  try {
    const bracket = generateBracket(db, req.params.id);
    res.status(201).json(bracket);
  } catch (error) {
    console.error(error);

    res.status(400).json({
      error: error.message || 'Ошибка генерации сетки'
    });
  }
});

// Добавление участника
app.post('/api/tournaments/:id/participants', (req, res) => {
  const tournamentId = req.params.id;
  const name = req.body.name;

  const tournament = getTournament(tournamentId);

  if (!tournament) {
    return res.status(404).json({
      error: 'Турнир не найден'
    });
  }

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      error: 'Укажи имя участника'
    });
  }

  if (name.trim().length > 40) {
    return res.status(400).json({
      error: 'Имя не должно превышать 40 символов'
    });
  }

  if (tournament.participantsCount >= tournament.maxParticipants) {
    return res.status(400).json({
      error: 'Турнир уже заполнен'
    });
  }

  const existing = db.prepare(`
    SELECT id FROM participants
    WHERE tournament_id = ? AND name = ? COLLATE NOCASE
  `).get(tournamentId, name.trim());

  if (existing) {
    return res.status(400).json({
      error: 'Такой участник уже добавлен'
    });
  }

  const position = db.prepare(`
    SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition
    FROM participants
    WHERE tournament_id = ?
  `).get(tournamentId).nextPosition;

  const transaction = db.transaction(() => {
    db.prepare(`
      DELETE FROM matches WHERE tournament_id = ?
    `).run(tournamentId);

    db.prepare(`
      INSERT INTO participants
      (tournament_id, name, position)
      VALUES (?, ?, ?)
    `).run(tournamentId, name.trim(), position);
  });

  transaction();

  res.status(201).json(getTournament(tournamentId));
});

// Удаление участника
app.delete(
  '/api/tournaments/:id/participants/:participantId',
  (req, res) => {
    const tournamentId = req.params.id;
    const participantId = Number(req.params.participantId);

    if (!getTournament(tournamentId)) {
      return res.status(404).json({
        error: 'Турнир не найден'
      });
    }

    const transaction = db.transaction(() => {
      db.prepare(`
        DELETE FROM matches WHERE tournament_id = ?
      `).run(tournamentId);

      return db.prepare(`
        DELETE FROM participants
        WHERE id = ? AND tournament_id = ?
      `).run(participantId, tournamentId);
    });

    const result = transaction();

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Участник не найден'
      });
    }

    res.json(getTournament(tournamentId));
  }
);

// Изменение порядка участников
app.patch(
  '/api/tournaments/:id/participants/reorder',
  (req, res) => {
    const tournamentId = req.params.id;
    const participantIds = req.body.participantIds;

    if (!getTournament(tournamentId)) {
      return res.status(404).json({
        error: 'Турнир не найден'
      });
    }

    if (
      !Array.isArray(participantIds) ||
      !participantIds.every(Number.isSafeInteger)
    ) {
      return res.status(400).json({
        error: 'Некорректный список участников'
      });
    }

    const currentIds = db.prepare(`
      SELECT id FROM participants
      WHERE tournament_id = ?
    `).all(tournamentId).map(p => p.id);

    if (
      participantIds.length !== currentIds.length ||
      new Set(participantIds).size !== participantIds.length ||
      !participantIds.every(id => currentIds.includes(id))
    ) {
      return res.status(400).json({
        error: 'Список участников не совпадает с базой данных'
      });
    }

    const updatePosition = db.prepare(`
      UPDATE participants
      SET position = ?
      WHERE id = ? AND tournament_id = ?
    `);


    const hadBracket = getBracket(db, tournamentId).rounds.length > 0;


    const transaction = db.transaction(() => {
      participantIds.forEach((id, index) => {
        updatePosition.run(index, id, tournamentId);
      });
    });

    transaction();


    if (hadBracket) {
      generateBracket(db, tournamentId);
    }

    res.json(getTournament(tournamentId));
  }
);


/* РЕДАКТИРОВАНИЕ МАТЧЕЙ */

// Изменение участника в конкретном матче
app.patch('/api/matches/:id/participant', (req, res) => {
  const matchId = Number(req.params.id);
  const slot = Number(req.body.slot);
  const manual = req.body.manual !== false;

  const participantId =
    req.body.participantId === null
      ? null
      : Number(req.body.participantId);

  const match = db.prepare(`
    SELECT * FROM matches WHERE id = ?
  `).get(matchId);

  if (!match) {
    return res.status(404).json({ error: 'Матч не найден' });
  }

  if (![1, 2].includes(slot)) {
    return res.status(400).json({ error: 'Неверный номер слота' });
  }

  if (
    participantId !== null &&
    !Number.isSafeInteger(participantId)
  ) {
    return res.status(400).json({
      error: 'Некорректный ID участника'
    });
  }

  if (!manual && participantId !== null) {
    return res.status(400).json({
      error: 'Автоматический слот не может содержать ручное назначение'
    });
  }

  if (participantId !== null) {
    const participant = db.prepare(`
      SELECT id FROM participants
      WHERE id = ? AND tournament_id = ?
    `).get(participantId, match.tournament_id);

    if (!participant) {
      return res.status(400).json({
        error: 'Участник не принадлежит этому турниру'
      });
    }

    const otherSlot = slot === 1
      ? match.participant2_id
      : match.participant1_id;

    if (otherSlot === participantId) {
      return res.status(400).json({
        error: 'Нельзя поставить одного участника на обе стороны матча'
      });
    }

    const duplicate = db.prepare(`
      SELECT id FROM matches
      WHERE tournament_id = ?
        AND round_number = ?
        AND id <> ?
        AND (
          participant1_id = ?
          OR participant2_id = ?
        )
    `).get(
      match.tournament_id,
      match.round_number,
      matchId,
      participantId,
      participantId
    );

    if (duplicate) {
      return res.status(400).json({
        error: 'Этот участник уже находится в другом матче данного раунда'
      });
    }
  }

  const participantColumn = slot === 1
    ? 'participant1_id'
    : 'participant2_id';

  const manualColumn = slot === 1
    ? 'participant1_manual'
    : 'participant2_manual';

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE matches
      SET
        ${participantColumn} = ?,
        ${manualColumn} = ?,
        winner_id = NULL,
        score1 = NULL,
        score2 = NULL
      WHERE id = ?
    `).run(
      participantId,
      manual ? 1 : 0,
      matchId
    );

    const updated = db.prepare(`
      SELECT participant1_id, participant2_id
      FROM matches
      WHERE id = ?
    `).get(matchId);

    const first = updated.participant1_id;
    const second = updated.participant2_id;

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
      SET status = ?, winner_id = ?
      WHERE id = ?
    `).run(status, winner, matchId);

    // Для автоматического слота заново получаем результат
    // предыдущего раунда.
    const startRound = manual
      ? match.round_number
      : Math.max(1, match.round_number - 1);

    rebuildAfterRound(db, match.tournament_id, startRound);
  });

  transaction();

  res.json(getBracket(db, match.tournament_id));
});

// Изменение даты и времени матча
app.patch('/api/matches/:id/date', (req, res) => {
  const matchId = Number(req.params.id);
  const matchDate = req.body.matchDate;

  const match = db.prepare(`
    SELECT tournament_id FROM matches WHERE id = ?
  `).get(matchId);

  if (!match) {
    return res.status(404).json({ error: 'Матч не найден' });
  }

  if (
    matchDate !== null &&
    (
      typeof matchDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(matchDate) ||
      !Number.isFinite(Date.parse(matchDate))
    )
  ) {
    return res.status(400).json({
      error: 'Некорректная дата матча'
    });
  }

  db.prepare(`
    UPDATE matches SET match_date = ?
    WHERE id = ?
  `).run(matchDate, matchId);

  res.json(getBracket(db, match.tournament_id));
});

// Выбор победителя матча
app.patch('/api/matches/:id/winner', (req, res) => {
  const matchId = Number(req.params.id);
  const winnerId = Number(req.body.winnerId);

  const match = db.prepare(`
    SELECT * FROM matches WHERE id = ?
  `).get(matchId);

  if (!match) {
    return res.status(404).json({ error: 'Матч не найден' });
  }

  if (
    !Number.isSafeInteger(winnerId) ||
    !match.participant1_id ||
    !match.participant2_id ||
    ![match.participant1_id, match.participant2_id].includes(winnerId)
  ) {
    return res.status(400).json({
      error: 'Выбери одного из участников данного матча'
    });
  }

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE matches
      SET winner_id = ?, status = 'completed'
      WHERE id = ?
    `).run(winnerId, matchId);

    // Победитель переходит в следующий раунд
    // Все последующие результаты пересчитываются.
    rebuildAfterRound(
      db,
      match.tournament_id,
      match.round_number
    );
  });

  transaction();

  res.json(getBracket(db, match.tournament_id));
});


// Удаление турнира
app.delete('/api/tournaments/:id', (req, res) => {
  const result = db.prepare(`
    DELETE FROM tournaments WHERE id = ?
  `).run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({
      error: 'Турнир не найден'
    });
  }

  res.status(204).end();
});

// Путь к собранному frontend
const frontendPath = path.resolve(
  __dirname,
  '../../frontend/dist'
);

// Раздача файлов сайта
app.use(express.static(frontendPath));

// Поддержка переходов между страницами React
app.use((req, res, next) => {
  if (
    req.method !== 'GET' ||
    req.path.startsWith('/api/')
  ) {
    return next();
  }

  res.sendFile(
    path.join(frontendPath, 'index.html'),
    (err) => {
      if (err) next(err);
    }
  );
});

// Обработка серверных ошибок
app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    error: 'Внутренняя ошибка сервера'
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
