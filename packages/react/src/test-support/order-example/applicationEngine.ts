import { NodeHttpClient } from "@effect/platform-node";
import { Context, Deferred, Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import type { ScreenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { Order } from "./contract.ts";
import { makeClient } from "./makeClient.ts";
import { ORDER_CHANGES, signedInSessions, startHost } from "./startHost.ts";

function client(url: string, token?: string) {
	return makeClient({ httpClient: NodeHttpClient.layerNodeHttp, token, url }).client;
}

export interface Screen {
	readonly container: HTMLElement;
	readonly driver: ScreenDriver;
}

export const createApplication = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const sql = yield* SqlClient.SqlClient;
	const sessions = signedInSessions();
	const saves = { entered: yield* Deferred.make<void>(), held: false, released: yield* Deferred.make<void>() };
	const gets = new Map<number, number>();
	const server = yield* startHost(database.url, sessions, {
		beforeGet: (id) =>
			Effect.sync(() => {
				gets.set(id, (gets.get(id) ?? 0) + 1);
			}),
		beforeSave: () => (saves.held ? Deferred.succeed(saves.entered, undefined).pipe(Effect.andThen(Deferred.await(saves.released))) : Effect.void),
	});
	const reactivity = Context.get(server.context, Reactivity.Reactivity);
	const changes: unknown[] = [];
	const unregister = reactivity.registerUnsafe(["orders"], () => changes.push("orders"));
	yield* Effect.addFinalizer(() => Effect.sync(unregister));
	let barriers = 0;
	// The host publishes committed changes through NOTIFY in commit order, so a later notification's arrival proves earlier ones arrived.
	const changesArrived = Effect.gen(function* () {
		barriers += 1;
		const key = `story-barrier-${barriers}`;
		const arrived = yield* Deferred.make<void>();
		const release = reactivity.registerUnsafe([key], () => Deferred.doneUnsafe(arrived, Effect.void));
		yield* sql`select pg_notify(${ORDER_CHANGES}, ${JSON.stringify([key])})`;
		yield* Deferred.await(arrived).pipe(Effect.ensuring(Effect.sync(release)));
	});
	yield* Effect.addFinalizer(() => Deferred.succeed(saves.released, undefined));
	const alice = yield* client(server.url, "alice-session");
	const bob = yield* client(server.url, "bob-session");
	const answers: string[] = [];
	return {
		alice,
		answers,
		bob,
		changes,
		changesArrived,
		connect: (token?: string) => client(server.url, token),
		gets,
		orders: new Map<string, Order>(),
		saves,
		screens: new Map<string, Screen>(),
		sessions,
		sql,
		url: server.url,
	};
});
export type Application = Effect.Success<typeof createApplication>;

export function orderId(engine: Application, alias: string) {
	const order = engine.orders.get(alias);
	if (order === undefined) {
		throw new Error(`No order is seeded as ${alias}`);
	}
	return order.id;
}
