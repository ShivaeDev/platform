import type { PostgresSettings } from "@shivaedev/sql/postgresSettings.ts";

// Tune these for the app's workload and memory budget; restart Postgres after changing startup-only settings.
export const postgresSettings = {
	"idle_in_transaction_session_timeout": "10min",
	"jit": "off",
	"max_connections": "50",
	"shared_buffers": "32MB",
} satisfies PostgresSettings;
