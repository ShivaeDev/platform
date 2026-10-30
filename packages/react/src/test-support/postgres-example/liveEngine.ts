import { Deferred, Effect, Redacted } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { Rejected } from "./contract.ts";
import { makeClient } from "./makeClient.ts";
import { type ServerOptions, startServer } from "./server.ts";
import { call, mountView } from "./view.tsx";

function start(databaseUrl: Redacted.Redacted<string>, options: ServerOptions) {
	return Effect.acquireRelease(
		Effect.promise(async () => {
			const server = await startServer(Redacted.value(databaseUrl), options);
			const views: Awaited<ReturnType<typeof mountView>>[] = [];
			return {
				...server,
				close: async () => {
					try {
						for (const screen of views.reverse()) {
							await screen.close();
						}
					} finally {
						await server.close();
					}
				},
				mount: async () => {
					const screen = await mountView(server.url);
					views.push(screen);
					return screen;
				},
			};
		}),
		(server) => Effect.promise(server.close),
	);
}

export function rejectedSave(url: string) {
	const client = makeClient(url, "alice-session");
	return call(client, client.api.save.run({ id: 1, name: "Rolled back", quantity: 999 }).pipe(Effect.result));
}

export const createLiveEngine = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const saving: { pending?: Promise<Awaited<ReturnType<typeof rejectedSave>>> } = {};
	const gate = { entered: yield* Deferred.make<void>(), held: false, rejected: false, released: yield* Deferred.make<void>() };
	const server = yield* start(database.url, {
		beforeCommit: Effect.gen(function* () {
			if (gate.held) {
				yield* Deferred.succeed(gate.entered, undefined);
				yield* Deferred.await(gate.released);
			}
			if (gate.rejected) {
				return yield* new Rejected();
			}
		}),
	});
	yield* Effect.addFinalizer(() => Deferred.succeed(gate.released, undefined));
	return {
		baseline: { deliveries: 0, reads: 0 },
		database,
		gate,
		saving,
		server,
		views: new Map<string, Awaited<ReturnType<typeof mountView>>>(),
	};
});
export type LiveEngine = Effect.Success<typeof createLiveEngine>;
export function view(engine: LiveEngine, name: string) {
	const found = engine.views.get(name);
	if (found === undefined) {
		throw new Error(`The ${name} editor is not open`);
	}
	return found;
}
