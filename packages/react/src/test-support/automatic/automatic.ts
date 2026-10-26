import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Queue, Redacted } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { connect } from "./connect.ts";
import { migrations } from "./feature.ts";
import { openHost } from "./openHost.ts";
import { openScreen } from "./openScreen.tsx";
import { openWorker } from "./openWorker.ts";

const configured = Effect.runSync(Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL").pipe(Config.option));
const layer = makePostgresTestLayer({
	migrations: { ...migrations, lockTimeout: "5 seconds" },
	url: configured._tag === "Some" ? configured.value : Redacted.make("postgresql://disabled"),
});

export const automatic = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const database = yield* PostgresTestDatabase;
		const name = yield* Config.String("APP_NAME").pipe(Config.withDefault(new URL(Redacted.value(database.url)).pathname));
		const channel = `changes_${createHash("sha256").update(name).digest("hex").slice(0, 32)}`;
		const pg = yield* PgClient.PgClient;
		const incoming = yield* pg.listen(channel);
		const notifications: string[] = [];
		yield* Effect.forever(
			Queue.take(incoming).pipe(
				Effect.tap((message) =>
					Effect.sync(() => {
						if (message.payload.startsWith("[")) {
							notifications.push(message.payload);
						}
					}),
				),
			),
		).pipe(Effect.forkScoped);
		const host = yield* Effect.acquireRelease(
			Effect.promise(() => openHost(database.url)),
			(value) => Effect.promise(value.close),
		);
		const worker = yield* Effect.acquireRelease(
			Effect.promise(() => openWorker(Redacted.value(database.url))),
			(value) => Effect.promise(value.close),
		);
		const screen = yield* Effect.acquireRelease(
			Effect.promise(() => openScreen(host.url)),
			(value) => Effect.promise(value.unmount),
		);
		return { host, notifications, screen, worker };
	},
	inspect: ({ host, screen }) => ({ publications: host.publications, reads: host.reads, text: screen.container.textContent }),
	layer,
	name: "automatic live queries",
	runIf: configured._tag === "Some",
	stages: ["screen"],
	verbs: (engine, story) => ({
		note: (id: number) => engine.screen.container.querySelector(`[data-note="${id}"]`)?.textContent,
		notifications: () => engine.notifications.map((payload) => JSON.parse(payload)),
		publications: () => [...engine.host.publications],
		reads: () => [...engine.host.reads],
		ready: () =>
			engine.screen.container.querySelector('[data-live="live"]') !== null && engine.screen.container.querySelector('[data-pending="true"]') === null,
		rename: (id: number, title: string) =>
			Effect.acquireUseRelease(
				Effect.sync(() => AtomRegistry.make()),
				(registry) => {
					story.tell(`a command renames note ${id}`);
					const client = connect(engine.host.url);
					return Effect.promise(
						async () =>
							await act(async () => Effect.runPromise(AtomRegistry.getResult(registry, client.runtime.atom(client.api.rename.run({ id, title }))))),
					);
				},
				(registry) => Effect.sync(() => registry.dispose()),
			),
		settle: () =>
			Effect.promise(async () => {
				await act(async () => {
					await setTimeout(100);
				});
			}),
		workerWrite: (id: number, title: string, rollback = false) => {
			story.tell(`a pg-boss worker ${rollback ? "rolls back" : "commits"} note ${id}`);
			return Effect.promise(async () => await act(async () => engine.worker.write(id, title, rollback)));
		},
	}),
});
