# WokiLite - Restaurant Reservation System

A lean, high-signal prototype of Woki's reservation engine focused on atomic, efficient table assignment per sector.

## 🏗️ Architecture

- **Backend**: Fastify + TypeScript + Drizzle ORM + Turso (SQLite)
- **Frontend**: Next.js 14 + React + Tailwind CSS
- **Database**: Turso (separate databases for dev/prod)
- **Key Features**:
  - Atomic table assignment with **Redis distributed locks** (per 15-min slot in [start, end))
  - Idempotent operations via `Idempotency-Key` header
  - Configurable reservation duration by party size
  - Advance booking policy enforcement
  - Timezone-aware scheduling with IANA timezones
  - Structured logging with request tracing (requestId)
  - Application metrics and observability

## 📁 Project Structure

```
woki-challenge-gonzalo/
├── backend/          # Fastify API server
├── frontend/         # Next.js web app
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 20.9.0
- npm or yarn
- Turso account and databases (dev + prod)
- **Redis** (for distributed locking; see below)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Turso credentials and REDIS_URL (optional, defaults to redis://localhost:6379)

# Generate and run migrations
npm run db:generate
npm run db:push

# Start dev server (ensure Redis is running locally or set REDIS_URL)
npm run dev
```

#### Redis (distributed lock)

Concurrency is enforced with **Redis distributed locks**: one lock per 15-minute slot in the reservation interval `[start, end)` (end exclusive). This prevents overlapping reservations (e.g. 20:00 and 20:15 in the same sector) from both succeeding.

- **Configure:** Set `REDIS_URL` in `.env`. Default: `redis://localhost:6379`.
- **Run Redis locally (Docker):**
  ```bash
  docker run -d --name redis -p 6379:6379 redis:7-alpine
  ```
- **Tests:** The test suite (including concurrency and overlapping-slot tests) requires a running Redis instance. Use the same Docker command above, or point `REDIS_URL` to your Redis.

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with API URL

# Start dev server
npm run dev
```

## 🧪 Testing

```bash
cd backend
npm test
```

The test suite includes:

- Happy path scenarios
- Concurrency handling (double-booking prevention)
- Idempotency validation
- Time boundary checks (adjacent reservations)
- Shift validation
- Advance booking policy validation
- Reservation cancellation and slot availability

## 📝 API Documentation

### Endpoints

#### GET `/availability`

Get available time slots for a restaurant sector on a specific date.

**Query Parameters:**

- `restaurantId` (string, required): Restaurant ID
- `sectorId` (string, required): Sector ID
- `date` (string, required): Date in YYYY-MM-DD format
- `partySize` (number, required): Number of guests (1-20)

**Response:**

```json
{
  "slotMinutes": 15,
  "durationMinutes": 90,
  "slots": [
    {
      "start": "2025-09-08T20:00:00-03:00",
      "available": true,
      "tables": ["T1", "T2"]
    },
    {
      "start": "2025-09-08T20:15:00-03:00",
      "available": false,
      "reason": "no_capacity"
    }
  ]
}
```

**Note:**

- `durationMinutes` varies based on party size if duration rules are configured:
  - ≤2 guests → 75 minutes
  - ≤4 guests → 90 minutes
  - ≤8 guests → 120 minutes
  - > 8 guests → 150 minutes
- `tables` array may contain multiple table IDs if a combination is needed (when no single table fits the party size)

#### POST `/reservations`

Create a new reservation.

**Headers:**

- `idempotency-key` (optional): Key for idempotent requests

**Body:**

```json
{
  "restaurantId": "R1",
  "sectorId": "S1",
  "partySize": 2,
  "startDateTimeISO": "2025-09-08T20:00:00-03:00",
  "customer": {
    "name": "John Doe",
    "phone": "+54 9 11 5555-1234",
    "email": "john@example.com"
  },
  "notes": "Window seat preferred"
}
```

**201 Created**
Returns the created reservation with assigned table(s) and calculated end time.

**Response example:**

```json
{
  "id": "RES_001",
  "restaurantId": "R1",
  "sectorId": "S1",
  "tableIds": ["T3", "T4"],
  "partySize": 8,
  "start": "2025-09-08T20:00:00-03:00",
  "end": "2025-09-08T21:30:00-03:00",
  "status": "CONFIRMED",
  "customer": { "name": "John Doe", "phone": "...", "email": "..." },
  "createdAt": "2025-09-08T19:50:21-03:00",
  "updatedAt": "2025-09-08T19:50:21-03:00"
}
```

**Note:** `tableIds` may contain multiple tables if no single table can accommodate the party size. The system automatically finds the best combination (minimizing number of tables and wasted capacity).

**400 Bad Request**

```json
{
  "error": "invalid_format",
  "detail": "Reservations must be made at least 30 minutes in advance"
}
```

**409 Conflict**

```json
{
  "error": "no_capacity",
  "detail": "No available table fits party size at requested time"
}
```

**422 Unprocessable Entity**

```json
{
  "error": "outside_service_window",
  "detail": "Requested time is outside shifts"
}
```

**Note:** The system validates:

- Advance booking policy (min/max advance time if configured)
- Reservation duration is calculated based on party size
- Time must be within restaurant shifts

#### GET `/reservations/day`

Get all reservations for a specific day.

**Query Parameters:**

- `restaurantId` (string, required): Restaurant ID
- `date` (string, required): Date in YYYY-MM-DD format
- `sectorId` (string, optional): Filter by sector (if omitted, returns all sectors)

**200 OK**

```json
{
  "date": "2025-09-08",
  "items": [
    {
      "id": "RES_001",
      "sectorId": "S1",
      "tableIds": ["T4"],
      "partySize": 4,
      "start": "2025-09-08T20:00:00-03:00",
      "end": "2025-09-08T21:30:00-03:00",
      "status": "CONFIRMED",
      "customer": {
        "name": "John Doe",
        "phone": "+54 9 11 5555-1234",
        "email": "john@example.com"
      },
      "createdAt": "2025-09-08T19:50:21-03:00",
      "updatedAt": "2025-09-08T19:50:21-03:00"
    }
  ]
}
```

#### DELETE `/reservations/:id`

Cancel a reservation by ID.

**204 No Content**

---

#### GET `/health`

Health check endpoint.

**200 OK**

```json
{
  "status": "ok",
  "timestamp": "2025-09-08T19:50:21-03:00"
}
```

---

#### GET `/metrics`

Get application metrics and statistics.

**200 OK**

```json
{
  "timestamp": "2025-09-08T19:50:21-03:00",
  "metrics": {
    "reservationsCreated": 42,
    "reservationsCancelled": 5,
    "reservationsUpdated": 3,
    "conflicts": 2,
    "idempotentHits": 8,
    "availabilityQueries": 156,
    "errors": 1,
    "summary": {
      "total": 50,
      "created": 42,
      "cancelled": 5,
      "updated": 3,
      "conflictRate": 4.0,
      "idempotencyHitRate": 19.05
    }
  }
}
```

---

#### PATCH `/reservations/:id`

Update an existing reservation.

**Headers:**

- `idempotency-key` (optional): Key for idempotent requests

**Body (all fields optional):**

```json
{
  "sectorId": "S2",
  "partySize": 6,
  "startDateTimeISO": "2025-09-08T21:00:00-03:00",
  "customer": {
    "name": "Jane Doe",
    "phone": "+54 9 11 5555-5678",
    "email": "jane@example.com"
  },
  "notes": "Updated notes"
}
```

**200 OK**
Returns the updated reservation (same format as POST response).

**409 Conflict**

```json
{
  "error": "no_capacity",
  "detail": "No available table for the updated reservation parameters"
}
```

**400 Bad Request**

```json
{
  "error": "invalid_format",
  "detail": "Reservations must be made at least 30 minutes in advance"
}
```

**422 Unprocessable Entity**

```json
{
  "error": "outside_service_window",
  "detail": "Requested time is outside shifts"
}
```

**Note:** When updating a reservation:

- If `sectorId`, `startDateTimeISO`, or `partySize` changes, the system will re-assign tables
- All validations (shifts, advance booking policy) are re-applied
- The reservation duration is recalculated based on the new party size
- Idempotency is supported via `Idempotency-Key` header

## 🎯 Core Features

- [x] Availability endpoint (15-min slots)
- [x] Table assignment algorithm (Best Fit Decreasing strategy with table combinations)
- [x] Reservation CRUD (Create, Read, Cancel)
- [x] Idempotency support (via `Idempotency-Key` header)
- [x] Concurrency handling (Redis distributed locks per 15-min slot, fail-fast)
- [x] Configurable reservation duration per restaurant

## 🎁 Bonus Features

- [x] Frontend day view with availability grid
- [x] Database persistence (Turso/SQLite)
- [x] Dark mode support
- [x] Responsive design
- [x] Public deployment (Railway + Vercel)
- [x] **BONUS 4**: Large-group approval flow (reservations ≥8 guests require approval)
- [x] **BONUS 5**: Table combinations within a sector (assign multiple tables when no single table fits)
- [x] **BONUS 6**: Advance booking policy (min/max advance time)
- [x] **BONUS 7**: Variable duration by party size (≤2→75min, ≤4→90min, ≤8→120min, >8→150min)
- [x] **BONUS 9**: Edit reservation (PATCH endpoint with re-validation and re-assignment)

### Large-Group Approval Flow (BONUS 4)

For party sizes equal to or greater than the restaurant's `largeGroupThreshold` (default: 8), reservations are created with `PENDING` status and require manual approval.

**Workflow:**

1. Customer creates a reservation for 8+ guests
2. System creates a `PENDING` reservation with an `expiresAt` timestamp (TTL: `pendingHoldTTLMinutes`, default: 30 minutes)
3. Restaurant staff can:
   - **Approve**: Changes status to `CONFIRMED` and removes expiration
   - **Reject**: Changes status to `CANCELLED`
4. If not approved/rejected within TTL, the reservation automatically expires (status → `CANCELLED`)

**API Endpoints:**

- `POST /reservations/:id/approve` - Approve a pending reservation
- `POST /reservations/:id/reject` - Reject a pending reservation
- `POST /reservations/expire-pending` - Manually expire pending holds (also runs automatically before new reservations)

**Configuration:**

- `largeGroupThreshold`: Party size that triggers approval flow (default: 8)
- `pendingHoldTTLMinutes`: Time-to-live for pending holds in minutes (default: 30)

**Example:**

```json
POST /reservations
{
  "restaurantId": "R1",
  "sectorId": "S1",
  "partySize": 10,
  "startDateTimeISO": "2026-01-25T20:00:00-03:00",
  "customer": { ... }
}

Response:
{
  "id": "RES_XYZ67890",
  "status": "PENDING",
  "expiresAt": "2026-01-25T20:30:00-03:00",
  ...
}
```

## 🚀 Deployment

### Backend Deployment (Railway)

1. **Create Railway Account & Project**

   - Go to [railway.app](https://railway.app)
   - Sign up/login and create a new project
   - Select "Deploy from GitHub repo" and connect your repository
   - Choose the `backend` folder as the root directory

2. **Configure Environment Variables**
   Add these variables in Railway dashboard:

   ```
   DATABASE_URL=libsql://your-database-url.turso.io
   TURSO_AUTH_TOKEN=your-turso-auth-token
   NODE_ENV=production
   PORT=3001
   FRONTEND_URL=https://your-frontend-domain.vercel.app
   ```

3. **Deploy**
   - Railway will automatically detect the `railway.json` config
   - It will run `npm install && npm run build` and then `npm start`
   - Wait for deployment to complete
   - Copy the generated URL (e.g., `https://your-backend.railway.app`)

### Frontend Deployment (Vercel)

1. **Create Vercel Account & Project**

   - Go to [vercel.com](https://vercel.com)
   - Sign up/login and click "Add New Project"
   - Import your GitHub repository
   - Set **Root Directory** to `frontend`

2. **Configure Environment Variables**
   Add this variable in Vercel dashboard:

   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   ```

3. **Deploy**

   - Click "Deploy"
   - Vercel will automatically build and deploy your Next.js app
   - Copy the generated URL (e.g., `https://your-app.vercel.app`)

4. **Update Backend CORS**
   - Go back to Railway dashboard
   - Update `FRONTEND_URL` environment variable with your Vercel URL
   - Redeploy the backend (or it will auto-redeploy)

### Database Setup (Turso)

1. **Create Production Database**

   - Go to [turso.tech](https://turso.tech)
   - Create a new database for production
   - Copy the database URL and auth token

2. **Run Migrations & Seed**
   ```bash
   cd backend
   # Set production DATABASE_URL and TURSO_AUTH_TOKEN (e.g. in .env or Railway env)
   npm run db:push
   npm run db:seed   # Required: creates sectors (Main Hall, Terrace, Bar) and tables
   ```
   Without the seed, the sectors "Terrace" and "Bar" (and their tables) won't exist; the frontend loads sectors from the API, so only sectors present in the DB will appear in the dropdown. If you see **"Test Sector"** in the app, the database was seeded by the test suite; run `npm run db:seed` (with production env) to replace it with **Main Hall**, **Terrace**, and **Bar**.

### Post-Deployment Checklist

- [ ] Backend health check: `https://your-backend.railway.app/health`
- [ ] Frontend loads correctly
- [ ] CORS is configured correctly (check browser console)
- [ ] Database migrations applied
- [ ] Seed data loaded (if needed)

## 🔧 Configuration

### Restaurant Settings

Restaurants can be configured with the following optional settings:

**Duration Rules** (`durationRules`): Define reservation duration based on party size

```json
{
  "durationRules": [
    { "maxPartySize": 2, "durationMinutes": 75 },
    { "maxPartySize": 4, "durationMinutes": 90 },
    { "maxPartySize": 8, "durationMinutes": 120 },
    { "maxPartySize": 999, "durationMinutes": 150 }
  ]
}
```

**Advance Booking Policy**:

- `minAdvanceMinutes`: Minimum minutes in advance (e.g., 30)
- `maxAdvanceDays`: Maximum days in advance (e.g., 30)

If not set, these validations are skipped.

**Shifts**: Define service windows

```json
{
  "shifts": [
    { "start": "12:00", "end": "16:00" },
    { "start": "20:00", "end": "23:45" }
  ]
}
```

If not set, the restaurant operates 24/7 (with respect to reservation duration).

### Table Assignment Strategy

The system uses a **Best Fit Decreasing** strategy for table assignment:

1. **Single Table (Preferred)**: First attempts to find a single table where `minSize ≤ partySize ≤ maxSize`
2. **Table Combinations (Fallback)**: If no single table fits, searches for combinations of 2-5 tables that together can accommodate the party size
3. **Optimization**: Prefers combinations that:
   - Minimize the number of tables used
   - Minimize wasted capacity (prefer tables with `maxSize` closest to `partySize`)

**Example:**

- Party size: 8 guests
- Available tables: T1 (maxSize=4), T2 (maxSize=4), T3 (maxSize=3), T4 (maxSize=3)
- Result: Assigns T1 + T2 (total maxSize=8, perfect fit) or T3 + T4 + T1 (if T1+T2 unavailable)

## 📊 Observability

### Logging

The application uses **structured logging** with Pino:

- **Request Tracing**: Each request gets a unique `requestId` (provided via `X-Request-Id` header or auto-generated)
- **Structured Logs**: All logs include context (requestId, operation, outcome, durationMs)
- **Log Levels**:
  - `debug`: Detailed information (development only)
  - `info`: Normal operations
  - `warn`: Expected errors (4xx)
  - `error`: Unexpected errors (5xx)

**Example log entry:**

```json
{
  "level": 30,
  "time": 1725807021000,
  "requestId": "req_ABC12345",
  "restaurantId": "R1",
  "sectorId": "S1",
  "partySize": 4,
  "operation": "create_reservation",
  "outcome": "success",
  "durationMs": 45,
  "msg": "Reservation created"
}
```

### Metrics

The application tracks basic metrics:

- **Reservations**: Created, cancelled, updated
- **Conflicts**: No capacity errors (409)
- **Idempotency**: Cache hits
- **Availability**: Query count
- **Errors**: Total error count

Access metrics via `GET /metrics` endpoint. Metrics are in-memory and reset on server restart.

**Note**: For production, consider integrating with Prometheus, StatsD, or similar metrics systems.

## 📄 License

ISC
