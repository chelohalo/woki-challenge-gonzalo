# WokiLite - Restaurant Reservation System

A lean, high-signal prototype of Woki's reservation engine focused on atomic, efficient table assignment per sector.

## 🏗️ Architecture

- **Backend**: Fastify + TypeScript + Drizzle ORM + Turso (SQLite)
- **Frontend**: Next.js 14 + React + Tailwind CSS
- **Database**: Turso (separate databases for dev/prod)

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

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your Turso credentials

# Generate and run migrations
npm run db:generate
npm run db:push

# Start dev server
npm run dev
```

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
      "start": "2025-09-08T20:00:00Z",
      "available": true,
      "tables": ["T1", "T2"]
    }
  ]
}
```

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

#### GET `/reservations/day`
Get all reservations for a specific day.

**Query Parameters:**
- `restaurantId` (string, required): Restaurant ID
- `date` (string, required): Date in YYYY-MM-DD format
- `sectorId` (string, optional): Filter by sector

#### DELETE `/reservations/:id`
Cancel a reservation by ID.

## 🎯 Core Features

- [x] Availability endpoint (15-min slots)
- [x] Table assignment algorithm (Best Fit Decreasing strategy)
- [x] Reservation CRUD (Create, Read, Cancel)
- [x] Idempotency support (via `Idempotency-Key` header)
- [x] Concurrency handling (in-memory locks with fail-fast)
- [x] Configurable reservation duration per restaurant

## 🎁 Bonus Features

- [x] Frontend day view with availability grid
- [x] Database persistence (Turso/SQLite)
- [x] Dark mode support
- [x] Responsive design
- [ ] Public deployment

## 📄 License

ISC
