ALTER TABLE users ADD COLUMN is_suspended boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE users ADD COLUMN suspension_reason text;
