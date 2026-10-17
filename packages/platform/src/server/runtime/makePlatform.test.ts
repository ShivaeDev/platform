import { expect } from "vitest";
import { runtimeApplication } from "#test/app-host/options.ts";
import { host } from "#test/app-host/story.ts";

host.it("builds the application layer once", [runtimeApplication], function* ({ runtimeValue, runtimeExit, runtimeLifecycle, close }) {
	expect(yield* runtimeValue()).toBe("base");
	expect(yield* runtimeValue()).toBe("base");
	expect(runtimeLifecycle()).toEqual(["acquired"]);
	expect(yield* runtimeExit()).toEqual({ success: "base" });
	yield* close();
	expect(runtimeLifecycle()).toEqual(["acquired", "disposed"]);
});
host.it("dispose releases the application layer exactly once", [runtimeApplication], function* ({ runtimeValue, runtimeLifecycle, close }) {
	expect(yield* runtimeValue()).toBe("base");
	expect(runtimeLifecycle()).toEqual(["acquired"]);
	yield* close();
	expect(runtimeLifecycle()).toEqual(["acquired", "disposed"]);
	yield* close();
	expect(runtimeLifecycle()).toEqual(["acquired", "disposed"]);
});
host.it("propagates ambient services across promise boundaries", [runtimeApplication], function* ({ runtimeValue }) {
	expect(yield* runtimeValue("request")).toBe("request");
});
host.it("nested service overrides replace outer values and restore them afterwards", [runtimeApplication], function* ({ nestedRuntimeServices }) {
	expect(yield* nestedRuntimeServices()).toEqual({
		after: ["outer", "outer-other"],
		base: ["base", "base-other"],
		before: ["outer", "outer-other"],
		inner: ["inner", "base-other"],
	});
});
host.it("shares development runtimes by an explicit cache key", [runtimeApplication], function* ({ developmentRuntimes }) {
	expect(yield* developmentRuntimes()).toBe(true);
});
host.it("rebuilds a fresh development runtime after disposal", [runtimeApplication], function* ({ recreatedDevelopmentRuntime }) {
	expect(yield* recreatedDevelopmentRuntime()).toEqual({
		after: ["acquired", "disposed", "acquired", "disposed"],
		before: ["acquired", "disposed", "acquired"],
		cached: true,
		fresh: true,
		retained: true,
		value: "base",
	});
});
host.it("rejects runPromise with the original typed failure", [runtimeApplication], function* ({ runtimeFailure }) {
	expect(yield* runtimeFailure()).toEqual({ exitOriginal: true, promiseOriginal: true });
});
host.it("a layer build failure preserves its exit and promise identity", [runtimeApplication], function* ({ runtimeLayerFailure }) {
	expect(yield* runtimeLayerFailure()).toEqual({ exitOriginal: true, promiseOriginal: true });
});
for (const run of ["runPromise", "runPromiseExit"] as const) {
	host.it(`${run} forwards cancellation and runs the finalizer`, [runtimeApplication], function* ({ cancelRuntime }) {
		expect(yield* cancelRuntime(run)).toEqual({ before: 0, finalized: 1, interrupted: true });
	});
}
host.it("contextEffect includes request services without retaining them for the next request", [runtimeApplication], function* ({ runtimeValue }) {
	expect(yield* runtimeValue("request-context", true)).toBe("request-context");
	expect(yield* runtimeValue(undefined, true)).toBe("base");
});
host.it("does not reuse development cache entries in production", [runtimeApplication], function* ({ productionRuntimes }) {
	expect(yield* productionRuntimes()).toBe("distinct");
});
