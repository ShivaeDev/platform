import { Cause, Effect, Exit, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { daemonLayer } from "#host/daemon.ts";
import { daemonResources } from "#test/daemonResources.ts";
import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

test("a Fleet migration failure prevents provider acquisition and scheduling", () =>
	withHost({}, {}, (fixture) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`delete from ${sql(`${fixture.host.namespace}_migrations`)} where migration_id >= 5`;
			const resources = yield* daemonResources(fixture.parts.provider);
			const parts = { ...fixture.parts, provider: resources.provider };
			const exit = yield* Effect.scoped(Layer.build(daemonLayer(fixture.host, parts, 0))).pipe(Effect.exit);
			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.pretty(exit.cause)).toContain("MigrationError");
			}
			expect(resources.providers).toBe(0);
			expect(fixture.provider.launched).toHaveLength(0);
		}),
	));
