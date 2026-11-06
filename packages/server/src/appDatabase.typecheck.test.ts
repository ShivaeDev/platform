import { Layer } from "effect";
import { Migrator } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import type { AppHostOptions, AppLocalHostOptions } from "#AppHostInput.ts";
import { type AppDatabaseOptions, appDatabase, appHost } from "#appDatabase.ts";
import { workerHost } from "#workerHost.ts";

it("database and database-backed host options require an explicit PostgreSQL settings declaration", () => {
	const omitted = { migrations: { loader: Migrator.fromRecord({}) } };
	// @ts-expect-error Database construction requires a server-settings declaration.
	appDatabase(omitted);
	// @ts-expect-error Database-backed HTTP hosts require a server-settings declaration.
	appHost({ ...omitted, policy: "loopback" });
	// @ts-expect-error Worker hosts require a server-settings declaration.
	workerHost({ ...omitted, services: Layer.empty, workers: Layer.empty });
	expectTypeOf(omitted).not.toExtend<AppDatabaseOptions>();
	expectTypeOf<Pick<AppHostOptions, "postgresSettings">>().toEqualTypeOf<Pick<AppDatabaseOptions, "postgresSettings">>();
	expectTypeOf<Pick<AppLocalHostOptions, "postgresSettings">>().toEqualTypeOf<Pick<AppDatabaseOptions, "postgresSettings">>();
	expectTypeOf({ ...omitted, postgresSettings: {} }).toExtend<AppDatabaseOptions>();
});
