import * as PgClient from "@effect/sql-pg/PgClient";
import { Context, Effect, Exit, Fiber, Layer, Option, Redacted, Scope } from "effect";
import { SqlClient, type SqlConnection } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { disconnectProxy } from "#disconnectProxy.ts";
import { adminUrl, configured } from "./postgres.ts";

export const proxy = storyKit({
	clock: "live",
	*create() {
		const scope = yield* Scope.fork(yield* Scope.Scope);
		const peer = yield* disconnectProxy(Redacted.value(adminUrl)).pipe(Scope.provide(scope));
		const context = yield* Layer.build(PgClient.layer({ maxConnections: 1, url: Redacted.make(peer.url) }));
		const sql = Context.get(context, SqlClient.SqlClient);
		const connection: { current?: SqlConnection.Connection; query?: Fiber.Fiber<readonly (readonly unknown[])[] | string> } = {};
		return { connection, peer, scope, sql };
	},
	name: "PostgreSQL fault proxy",
	runIf: configured,
	stages: ["connection"],
	verbs: ({ connection, peer, scope, sql }, story) => {
		const query = Effect.suspend(() => connection.current?.executeValues("select 42", []) ?? sql`select 42`.values).pipe(
			Effect.catch(() => Effect.succeed("connection failed")),
		);
		function pending() {
			if (connection.query === undefined) {
				throw new Error("No query is in flight");
			}
			return connection.query;
		}
		return {
			close: () => Scope.close(scope, Exit.void),
			disconnect: () => {
				story.tell("the proxy disconnects the PostgreSQL connection");
				return Effect.sync(peer.disconnect);
			},
			query: () => query,
			queryAnswer: () => Fiber.join(pending()),
			queryBeforeDeadline: () =>
				Fiber.await(pending()).pipe(
					Effect.timeoutOption("200 millis"),
					Effect.map((answer) => (Option.isNone(answer) ? "waiting" : "answered")),
				),
			refuse: () => {
				story.tell("the proxy refuses new PostgreSQL connections");
				return Effect.sync(() => peer.setReachable(false));
			},
			resume: () => {
				story.tell("the proxy resumes PostgreSQL traffic");
				return Effect.sync(() => peer.setResponsive(true));
			},
			stall: () => {
				story.tell("the proxy stalls PostgreSQL traffic");
				return Effect.sync(() => peer.setResponsive(false));
			},
			startQuery: () =>
				Effect.map(Effect.forkScoped(query), (fiber) => {
					connection.query = fiber;
				}),
		};
	},
});

export const connected = proxy.trait("connection", "a PostgreSQL connection is held open through the proxy", function* (engine) {
	engine.connection.current = yield* engine.sql.reserve;
});
