import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { processHost } from "#test/app-host/processStory.ts";

processHost.it("active work follows start order and removes completed work", [], function* ({ activeWork, launch, signal }) {
	yield* launch();
	expect(yield* activeWork()).toEqual(["greeting refresh", "notification stream"]);

	yield* signal("SIGUSR1");

	expect(yield* activeWork()).toEqual(["notification stream"]);
});

processHost.it(
	"after process cleanup the readouts retain work active at shutdown and finalizer completion order",
	[],
	function* ({ activeWork, closeScope, finalizers, launch, shutdown }) {
		yield* launch();
		yield* outcomes([
			["active work", () => activeWork(), ["greeting refresh", "notification stream"]],
			["completed finalizers", () => finalizers(), []],
		]);

		yield* shutdown();
		yield* closeScope();

		yield* outcomes([
			["completed finalizers", () => finalizers(), ["background workers", "HTTP host"]],
			["work active at shutdown", () => activeWork(), ["greeting refresh", "notification stream"]],
		]);
	},
);

processHost.it(
	"shutdown duration includes slow worker cleanup and remains readable after process cleanup",
	[],
	function* ({ closeScope, launch, shutdown, shutdownDuration }) {
		yield* launch();
		expect(yield* shutdownDuration()).toBeNull();

		yield* shutdown();
		yield* closeScope();

		expect(yield* shutdownDuration()).toBeGreaterThanOrEqual(50);
	},
);

processHost.it("finishing one of two identically named work items leaves the other active", [], function* ({ activeWork, launch, signal }) {
	yield* launch("same-work-names");
	expect(yield* activeWork()).toEqual(["notification stream", "notification stream"]);

	yield* signal("SIGUSR1");

	expect(yield* activeWork()).toEqual(["notification stream"]);
});

processHost.it("a child killed without a shutdown report fails its lifecycle readout", [], function* ({ activeWorkOutcome, closeScope, launch }) {
	yield* launch();

	yield* closeScope();

	expect(yield* activeWorkOutcome()).toBe("readout");
});
