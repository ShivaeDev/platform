import { expect } from "vitest";
import { postgresConfigured, processHost } from "#test/app-host/processStory.ts";

processHost.it("after IPC readiness the child host serves uncacheable health headers", [], function* ({ headers, launch }) {
	yield* launch();

	expect(yield* headers("/health")).toMatchObject({ "cache-control": "no-store" });
});

processHost.it("the acknowledged signal changes the greeting served by the host", [], function* ({ headers, launch, signal }) {
	yield* launch();
	expect(yield* headers("/greeting")).toMatchObject({ "x-greeting": "hello" });

	yield* signal("SIGUSR2");

	expect(yield* headers("/greeting")).toMatchObject({ "x-greeting": "goodbye" });
});

processHost.it.runIf(postgresConfigured)("the child host's health answer is healthy with PostgreSQL", [], function* ({ health, launch }) {
	yield* launch("database");

	expect(yield* health()).toMatchObject({ body: "", headers: { "cache-control": "no-store" }, status: 200 });
});

processHost.it("the child host's health answer is unavailable without a database", [], function* ({ health, launch }) {
	yield* launch();

	expect(yield* health()).toMatchObject({ body: "", headers: { "cache-control": "no-store" }, status: 503 });
});

processHost.it("closing the owning scope stops the child host answering HTTP", [], function* ({ closeScope, healthConnection, launch }) {
	yield* launch();
	expect(yield* healthConnection()).toBe("connected");

	yield* closeScope();

	expect(yield* healthConnection()).toBe("refused");
});

processHost.it("a child that exits before readiness reports a launch failure", [], function* ({ launchFailure }) {
	expect(yield* launchFailure()).toBe("launch");
});

processHost.it("a child that exits without acknowledging a signal reports a signal failure", [], function* ({ launch, signalOutcome }) {
	yield* launch();

	expect(yield* signalOutcome("SIGTERM")).toBe("signal failed");
});
