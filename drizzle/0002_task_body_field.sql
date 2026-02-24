ALTER TABLE `tasks` ADD `body` text;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `context`;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `execution_plan`;
