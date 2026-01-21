ALTER TABLE `reservations` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `large_group_threshold` integer;--> statement-breakpoint
ALTER TABLE `restaurants` ADD `pending_hold_ttl_minutes` integer;