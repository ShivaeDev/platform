import { expect } from "vitest";
import { runtimeApplication } from "#test/app-host/options.ts";
import { host } from "#test/app-host/story.ts";

host.it(
	"repeated runPromise calls reuse the application layer built at startup",
	[runtimeApplication],
	function* ({ runtimeLifecycle, runtimeValue }) {
		expect(yield* runtimeLifecycle()).toEqual(["acquired"]);

		yield* runtimeValue();
		yield* runtimeValue();

		expect(yield* runtimeLifecycle()).toEqual(["acquired"]);
	},
);

host.it("runPromise answers with the application layer's value", [runtimeApplication], function* ({ runtimeValue }) {
	expect(yield* runtimeValue()).toBe("base");
});

host.it("runPromiseExit succeeds with the application layer's value", [runtimeApplication], function* ({ runtimeExit }) {
	expect(yield* runtimeExit()).toBe("succeeded with base");
});

host.it("closing the host disposes the application layer", [runtimeApplication], function* ({ close, runtimeLifecycle }) {
	expect(yield* runtimeLifecycle()).toEqual(["acquired"]);

	yield* close();

	expect(yield* runtimeLifecycle()).toEqual(["acquired", "disposed"]);
});

host.it("closing the host a second time leaves the application layer disposed once", [runtimeApplication], function* ({ close, runtimeLifecycle }) {
	yield* close();
	expect(yield* runtimeLifecycle()).toEqual(["acquired", "disposed"]);

	yield* close();

	expect(yield* runtimeLifecycle()).toEqual(["acquired", "disposed"]);
});

host.it("runWithServices carries its override across an awaited promise into runPromise", [runtimeApplication], function* ({ runtimeValue }) {
	expect(yield* runtimeValue("request")).toBe("request");
});

host.it(
	"nested runWithServices overrides replace outer values inside and restore them afterwards",
	[runtimeApplication],
	function* ({ nestedRuntimeServices }) {
		expect(yield* nestedRuntimeServices()).toEqual({
			after: ["outer", "outer-other"],
			base: ["base", "base-other"],
			before: ["outer", "outer-other"],
			inner: ["inner", "base-other"],
		});
	},
);

host.it("development runtimes with one cache key share one runtime", [runtimeApplication], function* ({ developmentRuntimes }) {
	expect(yield* developmentRuntimes()).toBe("shared");
});

host.it("production runtimes with one cache key stay distinct", [runtimeApplication], function* ({ productionRuntimes }) {
	expect(yield* productionRuntimes()).toBe("distinct");
});

host.it(
	"a disposed development runtime is rebuilt fresh, cached under its key, kept when the old one is disposed again and released on disposal",
	[runtimeApplication],
	function* ({ recreatedDevelopmentRuntime }) {
		expect(yield* recreatedDevelopmentRuntime()).toEqual({
			"after disposing the cached runtime": "a fresh runtime",
			"application layer": {
				"after disposal": ["acquired", "disposed", "acquired", "disposed"],
				"while cached": ["acquired", "disposed", "acquired"],
			},
			"next lookup": "the fresh runtime",
			"value": "base",
			"when the old runtime is disposed again": "the fresh runtime stays cached",
		});
	},
);

for (const [failure, read] of [
	["an effect's typed failure", "runtimeFailure"],
	["an application layer's build failure", "runtimeLayerFailure"],
] as const) {
	host.it(`runPromise rejects and runPromiseExit fails with ${failure} itself`, [runtimeApplication], function* (verbs) {
		expect(yield* verbs[read]()).toEqual({ runPromise: "rejected with the original failure", runPromiseExit: "failed with the original failure" });
	});
}

for (const run of ["runPromise", "runPromiseExit"] as const) {
	host.it(`aborting ${run} interrupts its effect and runs its finalizer once`, [runtimeApplication], function* ({ abortedRun }) {
		expect(yield* abortedRun(run)).toEqual({ ending: "interrupted", finalizer: "ran once after the abort" });
	});
}

host.it("contextEffect includes request services for that request only", [runtimeApplication], function* ({ runtimeValue }) {
	expect(yield* runtimeValue("request-context", true)).toBe("request-context");

	yield* runtimeValue();

	expect(yield* runtimeValue(undefined, true)).toBe("base");
});
