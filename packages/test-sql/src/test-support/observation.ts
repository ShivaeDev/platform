import { randomUUID } from "node:crypto";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Exit, Layer, Option, Redacted, Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type ObserveOptions, observeUntil } from "#observeUntil.ts";
import { adminUrl, configured } from "./postgres.ts";

type Name = "alice" | "bob";

export type DuringTheWait = "alice closes after the first read" | "bob connects after the first read";

class ObservationEngine {
	readonly marker = `observe_${randomUUID().replaceAll("-", "")}`;
	readonly sessions = new Map<Name, Scope.Closeable>();
	readonly counts: number[] = [];
	outcome = "not waited";
	failure = "none";

	readonly admin: SqlClient.SqlClient;
	constructor(admin: SqlClient.SqlClient) {
		this.admin = admin;
	}

	connect(name: Name) {
		const engine = this;
		return Effect.gen(function* () {
			const url = new URL(Redacted.value(adminUrl));
			url.searchParams.set("application_name", `${engine.marker}_${name}`);
			const scope = yield* Effect.acquireRelease(Scope.make(), (session) => Scope.close(session, Exit.void));
			engine.sessions.set(name, scope);
			yield* PgClient.makeClient({ url: Redacted.make(url.toString()) }).pipe(Effect.provideService(Scope.Scope, scope));
		});
	}

	close(name: Name) {
		const scope = this.sessions.get(name);
		return scope === undefined ? Effect.die(new Error(`${name} has no session to close.`)) : Scope.close(scope, Exit.void);
	}

	openSessions() {
		return Effect.map(
			this.admin<{ count: number }>`select count(*)::int as count from pg_stat_activity where starts_with(application_name, ${this.marker})`,
			([row]) => row?.count ?? 0,
		);
	}
}

function sessionCount(count: number) {
	return `${count} open ${count === 1 ? "session" : "sessions"}`;
}

export const observation = storyKit({
	clock: "test",
	create: () => Effect.map(SqlClient.SqlClient, (admin) => new ObservationEngine(admin)),
	inspect: (engine) => ({ counts: engine.counts, sessions: [...engine.sessions.keys()] }),
	layer: PgClient.layer({ url: adminUrl }).pipe(Layer.provideMerge(Reactivity.layer)),
	name: "catalog observation",
	runIf: configured,
	stages: ["sessions"],
	verbs: (engine, story) => ({
		failureMessage: () => {
			story.tell("the story reads the observation failure message");
			return Effect.sync(() => engine.failure);
		},
		readsAtTheEnd: () => {
			story.tell("the story reads how many final observations agreed");
			return Effect.sync(() => {
				const last = engine.counts.at(-1);
				const differs = engine.counts.findLastIndex((count) => count !== last);
				return `${engine.counts.length - differs - 1} reads of ${last === undefined ? "nothing" : sessionCount(last)}`;
			});
		},
		sessionCountsSeen: () => {
			story.tell("the story reads the observed session count changes");
			return Effect.sync(() => engine.counts.filter((count, index) => index === 0 || count !== engine.counts[index - 1]).map(sessionCount));
		},
		waitForNoSessions: (options: ObserveOptions & { readonly during?: DuringTheWait } = {}) => {
			const { during, ...observe } = options;
			story.tell(`the story waits until no story session is open${during === undefined ? "" : `, and ${during}`}`);
			const change = during === "alice closes after the first read" ? engine.close("alice") : engine.connect("bob");
			const read = Effect.tap(engine.openSessions(), (count) =>
				Effect.suspend(() => {
					engine.counts.push(count);
					return during !== undefined && engine.counts.length === 1 ? change : Effect.void;
				}),
			);
			return observeUntil(read, (count) => count === 0, "no story session to be open", observe).pipe(
				Effect.map((count) => `settled on ${sessionCount(count)}`),
				Effect.catchTag("NeverSettled", (error) =>
					Effect.sync(() => {
						engine.failure = error.message;
						return `never settled, last read ${Option.match(error.last, { onNone: () => "nothing", onSome: sessionCount })}`;
					}),
				),
				Effect.flatMap((outcome) =>
					Effect.sync(() => {
						engine.outcome = outcome;
					}),
				),
			);
		},
		waitOutcome: () => {
			story.tell("the story reads the wait outcome");
			return Effect.sync(() => engine.outcome);
		},
	}),
});

export function sessionOpen(name: Name) {
	return observation.trait("sessions", `${name} holds an open PostgreSQL session`, (engine) => engine.connect(name));
}
