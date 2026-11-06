import { expect } from "vitest";
import { databaseStartup, differentServerSettings } from "#test-support/databaseStartup.ts";

databaseStartup.it(
	"application startup saves its lean PostgreSQL preset over different server settings",
	[differentServerSettings],
	function* ({ savedPostgresSettings, start }) {
		expect(yield* savedPostgresSettings()).toEqual({
			"idle_in_transaction_session_timeout": "0",
			"jit": "on",
			"max_connections": "60",
			"shared_buffers": "64MB",
		});

		yield* start();

		expect(yield* savedPostgresSettings()).toEqual({
			"idle_in_transaction_session_timeout": "10min",
			"jit": "off",
			"max_connections": "50",
			"shared_buffers": "32MB",
		});
	},
);
