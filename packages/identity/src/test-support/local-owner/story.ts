import { Effect, Fiber, Queue, Redacted, Stream } from "effect";
import { Migrator } from "effect/sql";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { machineTokenMigration } from "#server/adapters/machineTokenMigration.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { httpClient, socketClient } from "#test/local-owner/clients.ts";
import { ownerHost, REVALIDATION_INTERVAL } from "#test/local-owner/host.ts";
import { databaseUrl } from "#test/postgres.ts";

const postgres = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({ "1_machine_tokens": machineTokenMigration }), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});

export const ownerStory = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const host = yield* ownerHost();
		const machine = yield* host.local.machines.issue({ name: "reader agent", scope: "reader" });
		return { host, machine };
	},
	layer: postgres,
	name: "local owner and scoped machines on PostgreSQL",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: ({ host, machine }, story) => {
		let current = host;
		const previousOwner = Redacted.value(host.local.token);
		let subscription: { readonly next: Effect.Effect<string, unknown>; readonly closed: Effect.Effect<{ code: number; reason: string }> } | undefined;
		function closed() {
			return subscription === undefined ? Effect.die("No live query is open") : subscription.closed;
		}
		function token(caller: "owner" | "machine" | "missing" | "invalid" | "previous owner") {
			switch (caller) {
				case "missing":
					return undefined;
				case "invalid":
					return "invalid";
				case "previous owner":
					return previousOwner;
				case "owner":
					return Redacted.value(current.local.token);
				case "machine":
					return Redacted.value(machine.token);
			}
		}
		return {
			audit: () => Effect.sync(() => [...current.audit]),
			manage: (caller: "owner" | "machine", socket = false) =>
				Effect.gen(function* () {
					story.tell(`${caller} runs the owner command over ${socket ? "WebSocket" : "HTTP"}`);
					const credential = token(caller) ?? "";
					const client = socket ? (yield* socketClient(current.url, credential)).client : yield* httpClient(current.url, credential);
					return yield* answered(client["owner.manage"]());
				}),
			openLiveQuery: () =>
				Effect.gen(function* () {
					story.tell("the machine opens its live query with a first-frame bearer");
					const connection = yield* socketClient(current.url, Redacted.value(machine.token));
					const hints = yield* Queue.unbounded<string>();
					const following = yield* connection.client["local.$changes"]({ queries: [{ payload: undefined, query: "profile" }] }).pipe(
						Stream.runForEach((hint) => Queue.offer(hints, hint._tag)),
						Effect.forkScoped,
					);
					subscription = {
						closed: connection.closed,
						next: Effect.raceFirst(Queue.take(hints), Fiber.join(following).pipe(Effect.andThen(Effect.die("Subscription ended")))),
					};
				}),
			profile: (caller: "owner" | "machine" | "missing" | "invalid" | "previous owner") =>
				Effect.gen(function* () {
					story.tell(`${caller} reads the owner profile over HTTP`);
					const client = yield* httpClient(current.url, token(caller));
					return yield* answered(client["local.profile"]());
				}),
			rebuildHost: () =>
				Effect.gen(function* () {
					story.tell("another loopback host starts with a fresh owner credential over the same PostgreSQL database");
					current = yield* ownerHost();
				}),
			revalidationIntervalPasses: () => {
				story.tell("one socket revalidation interval passes");
				return untilTimer(REVALIDATION_INTERVAL).pipe(Effect.andThen(passes(REVALIDATION_INTERVAL, closed())), Effect.asVoid);
			},
			revoke: () => {
				story.tell("the owner revokes the machine token in PostgreSQL");
				return current.local.machines.revoke(machine.id);
			},
			scopeNotDeclared: () => {
				story.tell("the process tries to issue a token with an undeclared scope");
				return answered(current.local.machines.issue({ name: "unknown", scope: "undeclared" }));
			},
			subscriptionClosed: closed,
			subscriptionUpdate: () => (subscription === undefined ? Effect.die("No live query is open") : subscription.next),
		};
	},
});
