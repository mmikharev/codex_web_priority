# Eisenhower Matrix Planner

Single-page React application that helps manually sort backlog tasks into the Eisenhower decision matrix quadrants.

## Features
- Import JSON of `"task name": "DD. M. YYYY at HH:MM"` pairs into the backlog without page reloads.
- Drag and drop tasks between backlog and quadrants (HTML5 DnD, no external libs).
- Persist quadrant placement and task data via `localStorage`, including across reloads and re-imports.
- Filter backlog by title or date without hiding already placed cards in quadrants.
- Inline editing of task title and due date with normalized storage of blank dates.
- Keyboard shortcuts: `Ctrl+Shift+F` focus search, `Ctrl+Shift+I` focus import, `Ctrl+Shift+C` clear filter.
- Export current state to JSON (clipboard first, fallback download).

## Getting Started
```bash
npm install
npm run dev
```
Open the printed URL (default http://localhost:5173) to use the planner.

### Importing Tasks
1. Paste JSON like the following into the import textarea and press **Импорт**:
   ```json
   {
     "Alphamännchen Netflix moritz": "1. 10. 2025 at 0:00",
     "Создать общую папку долг в беклоге": "",
     "Buy scissors scissors": "17. 9. 2025 at 0:00"
   }
   ```
2. Optional: enable “Переместить все задачи в бэклог” to reset all tasks to backlog before applying new data.
3. Existing tasks keep their quadrant placement when re-imported; titles/dates update.

### Quadrants
- **Q1** — Срочно + Важно
- **Q2** — Несрочно + Важно
- **Q3** — Срочно + Неважно
- **Q4** — Несрочно + Неважно

Drag tasks from the backlog list into any quadrant. Use the **В бэклог** action on a card to return it to the backlog.

### Exporting
Use the **Экспорт** button to copy the full state to the clipboard (with a download fallback). The JSON structure is:
```json
{
  "tasks": {
    "Task name": {
      "title": "Task name",
      "due": "1. 10. 2025 at 0:00",
      "quadrant": "Q1"
    }
  }
}
```

### Testing
Run unit tests with:
```bash
npm test
```
Vitest runs in a jsdom environment and covers date parsing and task import logic.

## Project Structure
- `src/App.tsx` — top-level orchestration, search/filtering, hotkeys, import/export flows.
- `src/hooks/useTaskStore.ts` — state management, persistence, import rules.
- `src/components/` — UI elements: backlog list, quadrants board, task cards, import panel, search bar.
- `src/utils/` — date parsing/formatting and localStorage helpers.
- `src/test/` — Vitest setup and unit tests.

## Persisted Data
The application stores state in `localStorage` under `eisenhower_state_v1`. Use the in-app “Сбросить состояние” prompt if data becomes invalid.
