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
- [x] Public deployment (Railway + Vercel)

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

2. **Run Migrations**
   ```bash
   cd backend
   # Set production DATABASE_URL and TURSO_AUTH_TOKEN
   npm run db:push
   npm run db:seed  # Optional: seed initial data
   ```

### Post-Deployment Checklist

- [ ] Backend health check: `https://your-backend.railway.app/health`
- [ ] Frontend loads correctly
- [ ] CORS is configured correctly (check browser console)
- [ ] Database migrations applied
- [ ] Seed data loaded (if needed)

## 📄 License

ISC
