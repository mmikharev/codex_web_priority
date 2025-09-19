import { Quadrant, Task } from '../types';

const QUADRANT_TITLES: Record<Quadrant, string> = {
  backlog: 'Бэклог',
  Q1: 'Q1 — Срочно + Важно',
  Q2: 'Q2 — Несрочно + Важно',
  Q3: 'Q3 — Срочно + Неважно',
  Q4: 'Q4 — Несрочно + Неважно',
};

function formatTask(task: Task) {
  const status = task.done ? 'x' : ' ';
  const due = task.due ? ` _(до ${new Date(task.due).toLocaleString()})_` : '';
  return `- [${status}] ${task.title}${due}`;
}

export function createMarkdown(tasks: Task[]): string {
  const grouped: Record<Quadrant, Task[]> = { backlog: [], Q1: [], Q2: [], Q3: [], Q4: [] };
  tasks.forEach((task) => {
    const quadrant = grouped[task.quadrant] ? task.quadrant : 'backlog';
    grouped[quadrant].push(task);
  });

  const sections = (Object.keys(grouped) as Quadrant[]).map((quadrant) => {
    const items = grouped[quadrant].map(formatTask).join('\n');
    return [`## ${QUADRANT_TITLES[quadrant]}`, items || '_Нет задач_'].join('\n');
  });

  const date = new Date();
  const header = `# Список задач на ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;

  return [header, ...sections].join('\n\n');
}

export function createPrintableHtml(tasks: Task[]): string {
  const markdown = createMarkdown(tasks);
  const escaped = markdown
    .split('\n')
    .map((line) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Список задач</title>
    <style>
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 40px auto;
        max-width: 720px;
        line-height: 1.6;
        color: #0f172a;
      }
      h1, h2 { color: #1e293b; }
      code { font-family: inherit; }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <pre>${escaped}</pre>
    <script>
      setTimeout(() => window.print(), 400);
    </script>
  </body>
</html>`;
}
