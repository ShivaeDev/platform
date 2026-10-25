import { Effect } from "effect";
import { expect } from "vitest";
import { notesDeployment } from "#modules/notes/test-support/deployment.ts";
import { testPoolSizes } from "#test-support/poolSizes.ts";

const OK_STATUS = 200;
const SUCCESS_EXIT = 0;
const connections = 2 * (testPoolSizes.sql + testPoolSizes.auth + testPoolSizes.jobs);
const LISTEN_CONNECTIONS = 2;

notesDeployment.it(
	"keeps web and worker connections bounded while signing in and counting concurrent notes",
	[],
	function* ({ startProcess, signUpAt, signInAt, notesAt, watchBackends }) {
		const migrate = yield* startProcess("migrate");
		expect(yield* migrate.child.exitCode).toBe(SUCCESS_EXIT);
		const web = yield* startProcess("web", 0, { "AUTH_RATE_LIMIT_ENABLED": "false" });
		const worker = yield* startProcess("worker");
		yield* web.ready;
		yield* worker.ready;
		const activity = yield* watchBackends();
		expect((yield* signUpAt(web.url, "alice")).status).toBe(OK_STATUS);
		const results = yield* Effect.all(
			Array.from({ length: 8 }, (_, index) =>
				Effect.gen(function* () {
					const session = yield* signInAt(web.url, "alice");
					expect(session.status).toBe(OK_STATUS);
					const client = yield* notesAt(web.url, session.cookie);
					const note = yield* client["notes.create"]({ title: `Concurrent note ${index}` });
					return { client, note };
				}),
			),
			{ concurrency: "unbounded" },
		);
		for (const { client, note } of results) {
			yield* Effect.promise(() =>
				expect
					.poll(() => Effect.runPromise(client["notes.get"]({ id: note.id })), { timeout: 8000 })
					.toMatchObject({ title: note.title, wordCount: 3 }),
			);
		}
		yield* activity.stop;
		const counts = activity.counts();
		expect(counts.length).toBeGreaterThan(1);
		expect(Math.min(...counts)).toBeGreaterThan(0);
		expect(Math.max(...counts)).toBeLessThanOrEqual(connections + LISTEN_CONNECTIONS);
	},
	30_000,
);
