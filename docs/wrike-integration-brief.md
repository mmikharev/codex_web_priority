# Wrike MCP Integration Brief for Eisenhower Matrix Planner

## Overview
- **Goal**: Ingest Wrike notifications (mentions + new task assignments) for the authenticated user and surface them inside the Eisenhower matrix planner backlog while preserving the planner's local task schema.
- **Scope**: Read-only import of Wrike tasks triggered by inbox-style notifications, maintaining deduplication via Wrike IDs and aligning metadata for downstream prioritization.
- **Non-Goals**: Bidirectional task sync, updating Wrike tasks, or modifying planner quadrants automatically (reserved for later AI agent enhancements).

## Wrike MCP Endpoints
| Capability | Use Case | Key Params | Example Request | Relevant Response Fields |
|------------|----------|------------|-----------------|---------------------------|
| `wrike_get_my_contact_id` | Determine current Wrike user/contact ID for scoping notifications and tasks. | none | `{}` | `{ "contactId": "KUACNJKF" }`
| `wrike_search_tasks` | Fetch tasks referenced by notifications (mentions/assignments) to retrieve full metadata. | `responsibles`, `updatedDate`, `limit`, `fields` | `{ "responsibles": ["KUACNJKF"], "status": ["Active"], "limit": 50, "fields": ["description", "permalink", "dates", "importance", "authorIds"] }` | Returns array of task objects with `id`, `title`, `description`, `status`, `dates`, `importance`, `responsibleIds`, `authorIds`, etc.
| `wrike_get_task_comments` | Optional: Inspect mentions and comment context for urgency markers. | `taskId` | `{ "taskId": "MAAAAABpeRzX" }` | Comments list with `authorId`, `text`, `createdDate`, mention markup.
| `wrike_get_contacts` | Resolve author/responsible names for metadata. | `ids`, `fields` | `{ "ids": ["KUACNJKF"], "fields": ["firstName", "lastName", "email"] }` | Contact details.
| `wrike_get_approvals` (optional) | Track approval assignments that may map to tasks requiring attention. | `pendingApprovers`, `limit` | `{ "pendingApprovers": ["KUACNJKF"], "limit": 25 }` | Approval objects referencing task IDs.

> **Mentions feed**: Wrike MCP lacks a direct "notifications" endpoint, but mentions and assignments surface via task updates. Combine `wrike_get_my_contact_id` + `wrike_search_tasks` filtered by `responsibles` and optionally `updatedDate` >= last sync to approximate inbox.

### Sample Task Response Snippet
```json
{
  "id": "MAAAAABpeRzX",
  "title": "Prepare launch checklist",
  "status": "Active",
  "importance": "High",
  "permalink": "https://www.wrike.com/open.htm?id=1769544919",
  "responsibleIds": ["KUACNJKF"],
  "authorIds": ["KUAAAAAAUTHOR"],
  "dates": {
    "type": "Planned",
    "start": "2025-10-11",
    "due": "2025-10-25"
  },
  "description": "@Max finalize checklist by Friday",
  "customFields": []
}
```

## Auth Flow
1. **OAuth 2.0 Authorization Code**
   - Planner backend registers a Wrike API app and requests scopes: `Default`, `wsReadWrite` (for reading tasks/mentions), `DefaultRead` minimum.
   - Redirect user to Wrike authorization URL; capture `code` and exchange for `access_token` + `refresh_token` via backend.
2. **Token Storage**
   - Persist encrypted tokens server-side (e.g., database or secrets vault) keyed by planner user ID.
   - Access tokens expire (typically 1 hour); use refresh token to obtain new token when Wrike returns 401.
3. **MCP Invocation**
   - Backend uses Wrike MCP credentials (client ID/secret) to call MCP endpoints on behalf of user. If MCP requires contact context, include retrieved `contactId`.
4. **Identity Mapping**
   - Store mapping: Planner user ↔ Wrike contactId. This enables deduplication and ensures we fetch notifications only for the signed-in Wrike account.

## Integration Architecture Diagram
```
+-----------------+       HTTPS        +----------------------+       HTTPS        +-----------------------------+
| React Planner   | <----------------> | Planner Backend/API  | <----------------> | Wrike MCP API / Wrike Cloud |
| (SPA + localStore)|  sync payloads   | (Token proxy + cache)|  OAuth + MCP calls | (Tasks, comments, contacts) |
+-----------------+                    +----------------------+                    +-----------------------------+
        |                                                  |                               |
        | Local state via useTaskStore                     | Cache last sync timestamp      |
        v                                                  v                               v
+----------------------+                        +-----------------------+          +----------------+
| LocalStorage / Store | <--------------------> | Sync Controller       | <------> | Wrike resources|
+----------------------+    POST /sync/wrike    | (dedupe, transform)   |          +----------------+
```
- **Sync Trigger**: Planner calls backend `/api/wrike/notifications` on load and periodically (e.g., every 5 minutes) or on user action.
- **Backend Responsibilities**: Maintain last sync timestamp per user, call MCP endpoints, merge responses, and return normalized payloads.
- **Client Responsibilities**: Update `useTaskStore`, display imported tasks in backlog, track dedup state using Wrike IDs.

## Data Mapping Table
| Wrike Field | Planner Field | Transformation Notes | Example |
|-------------|---------------|----------------------|---------|
| `id` | `externalId` (new field) | Store as `wrike:<id>` to namespace IDs. | `wrike:MAAAAABpeRzX` |
| `title` | `title` | Direct copy. | `"Prepare launch checklist"` |
| `description` | `notes` | Strip mention markup, convert to Markdown/plain. | `"Max finalize checklist by Friday"` |
| `dates.due` | `dueDate` | ISO string; fallback to `null` if absent. | `"2025-10-25"` |
| `importance` | `priority` | Map Wrike `High/Normal/Low` → planner enum `urgent/high/normal`. | `"urgent"` |
| `status` | `status` | Map Wrike statuses to planner (`active`, `completed`). | `"active"` |
| `responsibleIds` | `assignees` | Resolve via `wrike_get_contacts`; store names/emails. | `["Max Mueller"]` |
| `authorIds` | `sourceAuthor` | Resolve author contact for attribution. | `"Product Lead"` |
| `permalink` | `sourceUrl` | Keep for deep-linking back to Wrike. | `"https://www.wrike.com/open.htm?id=1769544919"` |
| `createdDate` / `updatedDate` | `syncedAt` | Use for dedupe + ordering. | `"2025-10-12T09:32:11Z"` |
| `customFields` | `metadata.customFields` | Preserve array for AI enrichment. | `[ { "id": "CF123", "value": "Customer" } ]` |
| Derived: mention comment | `metadata.lastMention` | Parse comment text/time referencing user. | `{ "text": "@You urgent" }` |

## Example Implementation Snippets
### Backend (TypeScript / Express)
```ts
// pseudo-code
async function fetchWrikeNotifications(userId: string) {
  const { accessToken, contactId, lastSyncIso } = await tokenStore.get(userId);
  const filters = {
    responsibles: [contactId],
    status: ["Active"],
    sortField: "UpdatedDate",
    sortOrder: "Desc",
    limit: 50,
    fields: ["description", "permalink", "dates", "importance", "authorIds", "responsibleIds", "updatedDate", "createdDate", "customFields"]
  };
  if (lastSyncIso) filters.updatedDate = { from: lastSyncIso };

  const taskResponse = await wrikeMcpClient.call("wrike_search_tasks", filters, accessToken);
  const tasks = await enrichWithMentionContext(taskResponse.data, accessToken);
  return tasks.map(mapWrikeTaskToPlanner);
}
```

### Mapper Utility
```ts
function mapWrikeTaskToPlanner(task: WrikeTask): PlannerTask {
  return {
    id: uuid(),
    externalId: `wrike:${task.id}`,
    title: task.title,
    notes: cleanMarkup(task.description ?? ""),
    dueDate: task.dates?.due ?? null,
    priority: importanceToPriority(task.importance),
    quadrant: "backlog",
    status: task.status === "Completed" ? "done" : "pending",
    pomodorosCompleted: 0,
    pomodoroTarget: defaultPomodoroTarget(task),
    assignees: resolveContactNames(task.responsibleIds),
    metadata: {
      source: "wrike",
      sourceUrl: task.permalink,
      wrikeUpdated: task.updatedDate,
      customFields: task.customFields ?? []
    }
  };
}
```

### Frontend Sync Hook
```ts
export async function syncWrikeNotifications() {
  const response = await fetch("/api/wrike/notifications");
  if (!response.ok) throw new Error("Wrike sync failed");
  const payload: PlannerTask[] = await response.json();
  useTaskStore.getState().addFromWrike(payload);
}

// store slice extension
addFromWrike: (tasks) => set((state) => {
  const existingExternalIds = new Set(state.tasks.filter(t => t.externalId).map(t => t.externalId));
  const deduped = tasks.filter(t => !existingExternalIds.has(t.externalId));
  return { tasks: [...state.tasks, ...deduped] };
});
```

## Development Plan & TODOs

### Phase 1 – Foundations (Backend & Auth)
- [ ] Register Wrike application, capture client credentials, and document required scopes.
- [ ] Extend backend secrets storage to persist OAuth tokens + Wrike contact ID keyed by planner user.
- [ ] Implement `/api/auth/wrike/start` + `/api/auth/wrike/callback` routes that drive the OAuth 2.0 authorization-code flow.
- [ ] Add token refresh helper with automatic retry + exponential backoff when MCP calls return `401`/`429`.
- [ ] Create Wrike MCP client abstraction with typed request/response helpers (e.g., `wrikeClient.searchTasks(params)`).

### Phase 2 – Notification Sync Service
- [ ] Define persistence for `lastSyncAt` per user (DB column or KV cache) to support delta fetching.
- [ ] Implement backend controller `GET /api/wrike/notifications`:
  - [ ] Resolve `contactId` (fetch if absent, else read from cache).
  - [ ] Call `wrike_search_tasks` (and optional `wrike_get_task_comments`) filtered by `responsibles`, `updatedDate` >= `lastSyncAt`.
  - [ ] Transform Wrike tasks via `mapWrikeTaskToPlanner` and persist `externalId` + `syncedAt` metadata.
  - [ ] Update `lastSyncAt` after successful fetch.
- [ ] Add structured logging and metrics counters (e.g., imported task count, deduped count, API latency).

### Phase 3 – Frontend Integration
- [ ] Extend `useTaskStore` state to include `externalId`, `source`, and optional `metadata` fields.
- [ ] Implement `addFromWrike` reducer with deduplication by `externalId` + fallback to update existing task metadata.
- [ ] Create `useWrikeSync` hook that triggers on planner load, manual refresh button, and periodic polling (5–10 min).
- [ ] Display Wrike origin indicator (e.g., badge + deep link) inside backlog cards and provide error toast on sync failures.
- [ ] Gate sync features behind feature flag until QA passes.

### Phase 4 – Quality & Deployment
- [ ] Write unit tests for mapper utilities and reducers ensuring idempotent imports.
- [ ] Add integration tests (mock MCP) covering token refresh + rate-limit retry paths.
- [ ] Document operational playbook (token rotation, handling revoked consent, support runbooks).
- [ ] Roll out to staging, validate with pilot users, then enable in production behind gradual rollout toggle.

### Optional Enhancements (Post-MVP)
- [ ] Implement background job/webhook listener for near-real-time task pushes.
- [ ] Integrate AI prioritization worker that scores imported tasks and proposes quadrant placements.
- [ ] Backfill Wrike historical tasks (older than `lastSyncAt`) via manual sync command.

## Error Handling & Security
- **Token Expiry**: When MCP call returns 401, backend refreshes token transparently and retries once. On repeated failure, send 401 to client prompting re-auth.
- **Rate Limiting**: Wrike MCP enforces per-user quotas; implement exponential backoff and cap polling (e.g., 5-minute interval). Cache last results to avoid redundant calls.
- **Incomplete Payloads**: Guard null fields (e.g., missing `dates`). Default unknown importance to `"normal"` and schedule manual review.
- **Deduplication**: Persist `externalId` in local store; optionally store last sync timestamp server-side to minimize duplicates.
- **Security**: All MCP calls routed via backend; no Wrike tokens exposed to browser. Use HTTPS and store tokens encrypted at rest.

## Future Extensions
- **AI Prioritization**: Feed imported Wrike tasks to an AI agent (e.g., via MCP or planner-hosted LLM) that scores urgency/importance using metadata (due dates, `importance`, comment sentiment, responsible roles). Store AI score in `metadata.aiScore` and auto-place tasks into quadrants.
- **Webhook / Event-Driven Sync**: Wrike provides webhooks via its API (subscribe to task updates). Extend backend to receive webhook events, enqueue sync jobs, and push updates to planner via WebSocket for near-real-time updates.
- **Two-Way Sync**: Future enhancements could push completion status or quadrant changes back to Wrike using `wrike_update_task`.
- **Comment Analysis**: Use `wrike_get_task_comments` to extract textual cues ("urgent", "ASAP") aiding AI scoring and highlight tasks requiring attention.
