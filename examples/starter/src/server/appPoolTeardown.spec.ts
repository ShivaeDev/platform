import process from "node:process";
import { Effect } from "effect";
import { expect } from "vitest";
import { app, signedIn } from "#test-support/application.ts";

app.it(
	"closes the host, auth pool and job worker before dropping the story database",
	[signedIn()],
	function* ({ actor, startWorker, databaseLifetime }, context) {
		context.onTestFinished(() => {
			const lifetime = databaseLifetime();
			expect(lifetime.name).toMatch(/^effect_test_/u);
			expect(lifetime.scopeAtAppClose).toBe("Open");
			expect(lifetime.connectionAtAppClose).toEqual([{ available: 1 }]);
			expect(lifetime.connectionsAtAppClose).toEqual([]);
			expect(lifetime.teardownDuration).toBeLessThan(5000);
		});
		yield* Effect.promise(() => context.annotate(String(process.pid), "worker"));
		yield* Effect.promise(() => context.annotate(databaseLifetime().name, "database"));
		yield* startWorker();
		const note = yield* actor().notes.create({ title: "Count these words" });
		yield* Effect.promise(() =>
			expect.poll(() => Effect.runPromise(actor().notes.get({ id: note.id })), { timeout: 8000 }).toEqual({ ...note, version: 1, wordCount: 3 }),
		);
	},
);
