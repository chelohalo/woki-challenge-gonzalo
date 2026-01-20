import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const restaurants = sqliteTable('restaurants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull(),
  shifts: text('shifts', { mode: 'json' }).$type<Array<{ start: string; end: string }>>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const sectors = sqliteTable('sectors', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').notNull().references(() => restaurants.id),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const tables = sqliteTable('tables', {
  id: text('id').primaryKey(),
  sectorId: text('sector_id').notNull().references(() => sectors.id),
  name: text('name').notNull(),
  minSize: integer('min_size').notNull(),
  maxSize: integer('max_size').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const reservations = sqliteTable('reservations', {
  id: text('id').primaryKey(),
  restaurantId: text('restaurant_id').notNull().references(() => restaurants.id),
  sectorId: text('sector_id').notNull().references(() => sectors.id),
  tableIds: text('table_ids', { mode: 'json' }).$type<string[]>().notNull(),
  partySize: integer('party_size').notNull(),
  startDateTime: text('start_date_time').notNull(),
  endDateTime: text('end_date_time').notNull(),
  status: text('status', { enum: ['CONFIRMED', 'PENDING', 'CANCELLED'] }).notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  response: text('response', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull(),
});

// Relations
export const restaurantsRelations = relations(restaurants, ({ many }) => ({
  sectors: many(sectors),
}));

export const sectorsRelations = relations(sectors, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [sectors.restaurantId],
    references: [restaurants.id],
  }),
  tables: many(tables),
}));

export const tablesRelations = relations(tables, ({ one }) => ({
  sector: one(sectors, {
    fields: [tables.sectorId],
    references: [sectors.id],
  }),
}));
