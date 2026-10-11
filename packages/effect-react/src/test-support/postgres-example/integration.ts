import { Clock, Effect } from "effect";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { isolate, wholeStack } from "#test/order-example/isolation.ts";
import { databaseUrl, hasPostgres, StoryDatabase, workerDatabase } from "#test/order-example/postgres.ts";
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
			const views: Array<Awaited<ReturnType<typeof mountView>>> = [];
			return {
				...server,
				close: async () => {
					try {
						for (const view of views.reverse()) {
							await view.close();
						}
					} finally {
						await server.close();
					}
				},
				mount: async () => {
					const view = await mountView(server.url);
					views.push(view);
					return view;
				},
			};
		}),
		(server) => Effect.promise(server.close),
	);
}

const kit = storyKit({
	around: isolate(wholeStack),
	clock: "live",
	*create() {
		return yield* StoryDatabase;
	},
	inspect: (database) => ({ database: database.name }),
	layer: workerDatabase,
	name: "composed orders",
	stages: ["database"],
	verbs: (database, story) => ({
		start: (options: ServerOptions = {}) =>
			start(database.name, options).pipe(Effect.tap(Effect.sync(() => story.tell("the reference feature serves authenticated live HTTP RPC")))),
	}),
});

export const app = { ...kit, it: kit.it.runIf(hasPostgres) };
export function realPostgres() {
	return app.trait("database", "the reference feature uses a leased disposable PostgreSQL database", function* (database) {
		expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
		expect(database.sql).not.toBe(database.observer);
	});
}
