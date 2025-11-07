еimport express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 4000);
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'tasks.db');

const QUADRANTS = new Set(['backlog', 'Q1', 'Q2', 'Q3', 'Q4']);
const CONTEMPLATION_TAGS = new Set([
  'energy_high',
  'energy_gentle',
  'mood_pleasant',
  'mood_neutral',
]);

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  due TEXT,
  quadrant TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  contemplation_tag TEXT,
  captured_via_contemplation INTEGER NOT NULL DEFAULT 0
);
`);

const selectAll = db.prepare(`
  SELECT
    id,
    title,
    due,
    quadrant,
    done,
    created_at AS createdAt,
    completed_at AS completedAt,
    time_spent_seconds AS timeSpentSeconds,
    contemplation_tag AS contemplationTag,
    captured_via_contemplation AS capturedViaContemplation
  FROM tasks
`);

const selectOne = db.prepare(`
  SELECT
    id,
    title,
    due,
    quadrant,
    done,
    created_at AS createdAt,
    completed_at AS completedAt,
    time_spent_seconds AS timeSpentSeconds,
    contemplation_tag AS contemplationTag,
    captured_via_contemplation AS capturedViaContemplation
  FROM tasks
  WHERE id = ?
`);

const insertTask = db.prepare(`
  INSERT INTO tasks (
    id,
    title,
    due,
    quadrant,
    done,
    created_at,
    completed_at,
    time_spent_seconds,
    contemplation_tag,
    captured_via_contemplation
  ) VALUES (
    @id,
    @title,
    @due,
    @quadrant,
    @done,
    @createdAt,
    @completedAt,
    @timeSpentSeconds,
    @contemplationTag,
    @capturedViaContemplation
  )
`);

const updateTaskStmt = db.prepare(`
  UPDATE tasks SET
    title = @title,
    due = @due,
    quadrant = @quadrant,
    done = @done,
    created_at = @createdAt,
    completed_at = @completedAt,
    time_spent_seconds = @timeSpentSeconds,
    contemplation_tag = @contemplationTag,
    captured_via_contemplation = @capturedViaContemplation
  WHERE id = @id
`);

const deleteTaskStmt = db.prepare('DELETE FROM tasks WHERE id = ?');

const clearTasksStmt = db.prepare('DELETE FROM tasks');

function normalizeString(input) {
  if (typeof input !== 'string') {
    return '';
  }
  return input.trim();
}

function normalizeNullableString(input) {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeQuadrant(input, fallback) {
  if (typeof input === 'string' && QUADRANTS.has(input)) {
    return input;
  }
  return fallback ?? 'backlog';
}

function normalizeBoolean(input, fallback = false) {
  if (typeof input === 'boolean') {
    return input;
  }
  if (input === 1 || input === '1') {
    return true;
  }
  if (input === 0 || input === '0') {
    return false;
  }
  return fallback;
}

function normalizeTag(input) {
  if (typeof input !== 'string') {
    return null;
  }
  return CONTEMPLATION_TAGS.has(input) ? input : null;
}

function normalizeTimeSpent(input, fallback = 0) {
  if (typeof input !== 'number' || !Number.isFinite(input)) {
    return Math.max(0, fallback);
  }
  return Math.max(0, Math.round(input));
}

function ensureIsoString(input, fallback) {
  if (typeof input !== 'string') {
    return fallback;
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toISOString();
}

function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    due: row.due ?? null,
    quadrant: row.quadrant,
    done: Boolean(row.done),
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? null,
    timeSpentSeconds: row.timeSpentSeconds ?? 0,
    contemplationTag: row.contemplationTag ?? null,
    capturedViaContemplation: Boolean(row.capturedViaContemplation),
  };
}

function mapToTaskRecord(rows) {
  const record = {};
  for (const row of rows) {
    const task = rowToTask(row);
    record[task.id] = task;
  }
  return record;
}

function getAllTasks() {
  return mapToTaskRecord(selectAll.all());
}

function validateTaskPayload(payload, options = {}) {
  const { allowId = false } = options;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ожидается объект с данными задачи');
  }

  const trimmedTitle = normalizeString(payload.title);
  if (trimmedTitle.length === 0) {
    throw new Error('Название задачи не может быть пустым');
  }

  const due = normalizeNullableString(payload.due);
  const quadrant = normalizeQuadrant(payload.quadrant, 'backlog');
  if (!QUADRANTS.has(quadrant)) {
    throw new Error('Некорректный квадрант');
  }

  const done = normalizeBoolean(payload.done, false);
  const createdAt = ensureIsoString(payload.createdAt, new Date().toISOString());
  const completedAt = done
    ? ensureIsoString(payload.completedAt, new Date().toISOString())
    : null;
  const timeSpentSeconds = normalizeTimeSpent(payload.timeSpentSeconds, 0);
  const contemplationTag = normalizeTag(payload.contemplationTag);
  const capturedViaContemplation = normalizeBoolean(payload.capturedViaContemplation, false);

  const id = allowId && typeof payload.id === 'string' && payload.id.trim().length > 0
    ? payload.id.trim()
    : randomUUID();

  return {
    id,
    title: trimmedTitle,
    due,
    quadrant,
    done,
    createdAt,
    completedAt,
    timeSpentSeconds,
    contemplationTag,
    capturedViaContemplation,
  };
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/tasks', (_req, res) => {
  res.json({ tasks: getAllTasks() });
});

app.post('/api/tasks', (req, res) => {
  try {
    const task = validateTaskPayload(req.body ?? {}, { allowId: true });
    insertTask.run({
      id: task.id,
      title: task.title,
      due: task.due,
      quadrant: task.quadrant,
      done: task.done ? 1 : 0,
      createdAt: task.createdAt,
      completedAt: task.completedAt,
      timeSpentSeconds: task.timeSpentSeconds,
      contemplationTag: task.contemplationTag,
      capturedViaContemplation: task.capturedViaContemplation ? 1 : 0,
    });
    const inserted = selectOne.get(task.id);
    res.status(201).json({ task: rowToTask(inserted) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Некорректный запрос' });
  }
});

app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const existing = selectOne.get(id);
  if (!existing) {
    res.status(404).json({ error: 'Задача не найдена' });
    return;
  }

  try {
    const payload = req.body ?? {};
    const title =
      typeof payload.title === 'string' && payload.title.trim().length > 0
        ? payload.title.trim()
        : existing.title;
    const due = normalizeNullableString(
      Object.prototype.hasOwnProperty.call(payload, 'due') ? payload.due : existing.due,
    );
    const quadrant = normalizeQuadrant(
      Object.prototype.hasOwnProperty.call(payload, 'quadrant') ? payload.quadrant : existing.quadrant,
      existing.quadrant,
    );
    if (!QUADRANTS.has(quadrant)) {
      throw new Error('Некорректный квадрант');
    }

    const done = normalizeBoolean(
      Object.prototype.hasOwnProperty.call(payload, 'done') ? payload.done : existing.done,
      Boolean(existing.done),
    );

    const createdAt = ensureIsoString(
      Object.prototype.hasOwnProperty.call(payload, 'createdAt') ? payload.createdAt : existing.createdAt,
      existing.createdAt,
    );

    let completedAt = existing.completedAt;
    if (Object.prototype.hasOwnProperty.call(payload, 'completedAt')) {
      completedAt = payload.completedAt ? ensureIsoString(payload.completedAt, existing.completedAt) : null;
    } else if (done && !existing.done) {
      completedAt = new Date().toISOString();
    } else if (!done) {
      completedAt = null;
    }

    const timeSpentSeconds = normalizeTimeSpent(
      Object.prototype.hasOwnProperty.call(payload, 'timeSpentSeconds')
        ? payload.timeSpentSeconds
        : existing.timeSpentSeconds,
      existing.timeSpentSeconds,
    );

    const contemplationTag = Object.prototype.hasOwnProperty.call(payload, 'contemplationTag')
      ? normalizeTag(payload.contemplationTag)
      : normalizeTag(existing.contemplationTag);

    const capturedViaContemplation = normalizeBoolean(
      Object.prototype.hasOwnProperty.call(payload, 'capturedViaContemplation')
        ? payload.capturedViaContemplation
        : existing.capturedViaContemplation,
      Boolean(existing.capturedViaContemplation),
    );

    updateTaskStmt.run({
      id,
      title,
      due,
      quadrant,
      done: done ? 1 : 0,
      createdAt,
      completedAt,
      timeSpentSeconds,
      contemplationTag,
      capturedViaContemplation: capturedViaContemplation ? 1 : 0,
    });

    const updated = selectOne.get(id);
    res.json({ task: rowToTask(updated) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Некорректный запрос' });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  const { changes } = deleteTaskStmt.run(req.params.id);
  if (changes === 0) {
    res.status(404).json({ error: 'Задача не найдена' });
    return;
  }
  res.status(204).end();
});

app.put('/api/tasks', (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object' || !payload.tasks || typeof payload.tasks !== 'object') {
    res.status(400).json({ error: 'Ожидается объект вида { tasks: Record<string, Task> }' });
    return;
  }

  const entries = Object.entries(payload.tasks);
  try {
    const tasks = entries.map(([key, descriptor]) =>
      validateTaskPayload({ ...(descriptor ?? {}), id: key }, { allowId: true }),
    );
    const run = db.transaction((list) => {
      clearTasksStmt.run();
      for (const task of list) {
        insertTask.run({
          id: task.id,
          title: task.title,
          due: task.due,
          quadrant: task.quadrant,
          done: task.done ? 1 : 0,
          createdAt: task.createdAt,
          completedAt: task.completedAt,
          timeSpentSeconds: task.timeSpentSeconds,
          contemplationTag: task.contemplationTag,
          capturedViaContemplation: task.capturedViaContemplation ? 1 : 0,
        });
      }
    });
    run(tasks);
    res.json({ tasks: getAllTasks() });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Некорректный запрос' });
  }
});

app.delete('/api/tasks', (_req, res) => {
  clearTasksStmt.run();
  res.status(204).end();
});

const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`SQLite task API listening on http://localhost:${PORT}`);
  console.log(`Using database at ${DB_PATH}`);
});
