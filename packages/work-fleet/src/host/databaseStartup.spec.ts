import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { databaseStartup } from "#test/databaseStartup.ts";

databaseStartup.it("the original daemon backs off, logs its wait and serves requests once PostgreSQL starts", [], function* (daemon) {
	yield* daemon.startDaemon();

	yield* outcomes({
		"daemon remains running": [daemon.isRunning(), true],
		"next retry delay": [daemon.nextRetry(), "1s"],
		"recorded startup log": [
			daemon.logs(),
			expect.arrayContaining(["Waiting for PostgreSQL at database.url; retrying with backoff (1–10 seconds) for up to 5 minutes"]),
		],
	});

	yield* daemon.advance("1 second");

	expect(yield* daemon.nextRetry()).toBe("2s");

	yield* daemon.startDatabase();
	yield* daemon.advance("2 seconds");

	yield* outcomes({
		"daemon remains running": [daemon.isRunning(), true],
		"daemon snapshot": [daemon.snapshot(), [[]]],
		"recorded ready log": [daemon.logs(), expect.arrayContaining(["PostgreSQL at database.url is ready; starting Fleet daemon"])],
	});
});

databaseStartup.it("an unavailable database fails only after five minutes with a typed error naming database.url", [], function* (daemon) {
	yield* daemon.startDaemon();
	yield* daemon.nextRetry();
	yield* daemon.advance("299 seconds");

	expect(yield* daemon.isRunning()).toBe(true);

	yield* daemon.advance("1 second");

	expect(yield* daemon.failure()).toMatchObject({
		_tag: "HostFailure",
		message: "Timed out after 5 minutes waiting for PostgreSQL at database.url",
	});
});

databaseStartup.it("a daemon waiting for PostgreSQL can be stopped", [], function* (daemon) {
	yield* daemon.startDaemon();
	yield* daemon.nextRetry();

	yield* daemon.stopDaemon();

	expect(yield* daemon.isRunning()).toBe(false);
});
