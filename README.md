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

_Coming soon - API endpoints will be documented here_

## 🎯 Core Features

- [ ] Availability endpoint (15-min slots)
- [ ] Table assignment algorithm
- [ ] Reservation CRUD
- [ ] Idempotency support
- [ ] Concurrency handling

## 🎁 Bonus Features

- [ ] Frontend day view
- [ ] Public deployment
- [ ] Database persistence
- [ ] Additional features TBD

## 📄 License

ISC
