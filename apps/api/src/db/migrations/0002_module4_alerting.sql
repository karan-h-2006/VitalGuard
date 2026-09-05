ALTER TABLE "users" ADD COLUMN "phone_number" varchar(32);--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "explanation" text NOT NULL DEFAULT 'Legacy alert without Module 4 explanation';--> statement-breakpoint
ALTER TABLE "alerts" ALTER COLUMN "explanation" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "ack_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "acknowledged_by" uuid;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "escalation_level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "alerts" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
