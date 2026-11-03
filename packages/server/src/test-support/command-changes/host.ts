import type * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Layer, Queue, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { postgresChanges } from "@shivaedev/sql/postgresChanges.ts";
import { notes } from "./fixture.ts";

export const host = Effect.fnUntraced(function* (client: PgClient.PgClient, channel: string, faults: { broadcastFails: boolean }) {
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const broadcaster = new Proxy(client, {
		apply(target, receiver, parameters) {
			const statement = Reflect.apply(target, receiver, parameters);
			return Effect.suspend(() => (faults.broadcastFails ? client`select 1 / 0` : statement));
		},
	});
	const binding = yield* Layer.build(postgresChanges({ channel, client: broadcaster, heartbeatInterval: "1 hour", resync: live.resync })).pipe(
		Effect.provideService(Reactivity.Reactivity, reactivity),
	);
	const hints = yield* Queue.unbounded<LiveHint>();
	yield* live.stream([notes.item(1)]).pipe(
		Stream.runForEach((hint) => Queue.offer(hints, hint)),
		Effect.forkScoped,
	);
	const initial = yield* Queue.take(hints);
	return {
		initial,
		next: Queue.take(hints).pipe(Effect.timeout("5 seconds")),
		services: Context.add(binding, SqlClient.SqlClient, client).pipe(Context.add(Reactivity.Reactivity, reactivity)),
	};
});
