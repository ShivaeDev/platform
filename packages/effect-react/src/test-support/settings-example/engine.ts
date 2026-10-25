import { Deferred, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { Screen } from "#test/Screen.ts";
import type { openScreen } from "./openScreen.tsx";
import { startHost } from "./startHost.ts";
import { withReact } from "./withReact.ts";

export const createEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const sql = yield* SqlClient.SqlClient;
	// Entity ownership is an existing, signed-in precondition; settings start absent.
	yield* sql`insert into entities (id, "ownerId") values (1, 'alice'), (2, 'bob')`;
	const gate = { entered: yield* Deferred.make<void>(), held: false, released: yield* Deferred.make<void>() };
	yield* Effect.addFinalizer(() => Deferred.succeed(gate.released, undefined));
	const host = yield* startHost(database.url, (keys) =>
		Effect.gen(function* () {
			if (gate.held && keys.includes("entity-settings:1")) {
				yield* Deferred.succeed(gate.entered, undefined);
				yield* Deferred.await(gate.released);
				gate.held = false;
			}
		}),
	);
	return {
		...host,
		gate,
		screen: new Screen(() => undefined),
		screens: new Map<string, Effect.Success<ReturnType<typeof openScreen>>>(),
		stored: () =>
			withReact(
				sql<{ readonly entityId: number; readonly pageSize: number; readonly title: string }>`select * from entity_settings order by "entityId"`,
			),
	};
});
export type Engine = Effect.Success<typeof createEngine>;
export function screen(engine: Engine, name: string) {
	const found = engine.screens.get(name);
	if (!found) {
		throw new Error(`The ${name} settings screen is not open`);
	}
	return found;
}
