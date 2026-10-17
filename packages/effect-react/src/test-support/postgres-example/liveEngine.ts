import { Deferred, Effect } from "effect";
import { databaseUrl, StoryDatabase } from "#test/order-example/postgres.ts";
import { Rejected } from "./contract.ts";
import { type ServerOptions, startServer } from "./server.ts";
import { mountView } from "./view.tsx";

function start(name: string, options: ServerOptions) {
	return Effect.acquireRelease(
		Effect.promise(async () => {
			if (databaseUrl._tag === "None") {
				throw new Error("PostgreSQL URL is required");
			}
			const url = new URL(databaseUrl.value);
			url.pathname = `/${name}`;
			const server = await startServer(url.toString(), options);
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

export const createLiveEngine = Effect.gen(function* () {
	const database = yield* StoryDatabase;
	const saving: { pending?: Promise<unknown> } = {};
	const gate = { entered: yield* Deferred.make<void>(), held: false, rejected: false, released: yield* Deferred.make<void>() };
	const server = yield* start(database.name, {
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
