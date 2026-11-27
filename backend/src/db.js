
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

// Создаём папку для базы данных
const databaseDir = path.resolve(__dirname, '../database');

fs.mkdirSync(databaseDir, { recursive: true });

// Подключаем SQLite
const db = new Database(
    path.join(databaseDir, 'tournaments.sqlite')
);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Создаём таблицы
db.exec(`
  CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    game TEXT NOT NULL,
    date TEXT NOT NULL,
    participants_count INTEGER NOT NULL,
    status TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id TEXT NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,

    FOREIGN KEY (tournament_id)
      REFERENCES tournaments(id)
      ON DELETE CASCADE
  );
`);


// Таблица турнирных матчей
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tournament_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL,

    participant1_id INTEGER,
    participant2_id INTEGER,

    winner_id INTEGER,

    score1 INTEGER,
    score2 INTEGER,

    status TEXT NOT NULL DEFAULT 'pending',

    FOREIGN KEY (tournament_id)
      REFERENCES tournaments(id)
      ON DELETE CASCADE,

    FOREIGN KEY (participant1_id)
      REFERENCES participants(id)
      ON DELETE SET NULL,

    FOREIGN KEY (participant2_id)
      REFERENCES participants(id)
      ON DELETE SET NULL,

    FOREIGN KEY (winner_id)
      REFERENCES participants(id)
      ON DELETE SET NULL,

    UNIQUE (tournament_id, round_number, match_number)
  );

  CREATE INDEX IF NOT EXISTS idx_matches_tournament
  ON matches(tournament_id);
`);



// Дополнительные поля для редактирования матчей
const matchColumns = db.prepare(
    'PRAGMA table_info(matches)'
).all().map((column) => column.name);

if (!matchColumns.includes('match_date')) {
    db.exec(`
    ALTER TABLE matches ADD COLUMN match_date TEXT
  `);
}

if (!matchColumns.includes('participant1_manual')) {
    db.exec(`
    ALTER TABLE matches
    ADD COLUMN participant1_manual INTEGER NOT NULL DEFAULT 0
  `);
}

if (!matchColumns.includes('participant2_manual')) {
    db.exec(`
    ALTER TABLE matches
    ADD COLUMN participant2_manual INTEGER NOT NULL DEFAULT 0
  `);
}





// Начальные демонстрационные турниры
const demoTournaments = [
    {
        id: 't1',
        title: 'Valorant Championship',
        game: 'VALORANT',
        date: '27.11.2026',
        capacity: 8,
        status: 'В процессе',
        participants: [
            'Sentinels',
            'Fnatic',
            'Team Liquid',
            'NAVI',
            'G2 Esports',
            'LOUD',
            'Cloud9',
            'Vitality',
        ],
    },
    {
        id: 't2',
        title: 'CS2 Open Cup',
        game: 'CS2',
        date: '29.11.2026',
        capacity: 8,
        status: 'Запланирован',
        participants: [
            'Team Spirit',
            'NAVI',
            'FaZe',
            'G2',
            'Vitality',
            'MOUZ',
            'FURIA',
            'Astralis',
        ],
    },
    {
        id: 't3',
        title: 'Rocket League Finals',
        game: 'ROCKET LEAGUE',
        date: '20.11.2026',
        capacity: 4,
        status: 'Завершён',
        participants: [
            'Karmine Corp',
            'Gen.G',
            'Vitality',
            'G2',
        ],
    },
];

const seedDatabase = db.transaction(() => {
    for (const tournament of demoTournaments) {
        const exists = db.prepare(
            'SELECT id FROM tournaments WHERE id = ?'
        ).get(tournament.id);

        if (exists) continue;

        db.prepare(`
      INSERT INTO tournaments
      (id, title, game, date, participants_count, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
            tournament.id,
            tournament.title,
            tournament.game,
            tournament.date,
            tournament.capacity,
            tournament.status
        );

        tournament.participants.forEach((name, index) => {
            db.prepare(`
        INSERT INTO participants
        (tournament_id, name, position)
        VALUES (?, ?, ?)
      `).run(tournament.id, name, index);
        });
    }
});

seedDatabase();

console.log('SQLite database connected!');

module.exports = db;
