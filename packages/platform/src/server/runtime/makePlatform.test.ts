import { expect } from "vitest";
import { runtimeApplication } from "#test/app-host/options.ts";
import { host } from "#test/app-host/story.ts";

host.it("builds the application layer once", [runtimeApplication], function* ({ runtimeValue, runtimeLifecycle, close }) {
	expect(yield* runtimeValue()).toBe("base");
	expect(yield* runtimeValue()).toBe("base");
	expect(runtimeLifecycle()).toEqual(["acquired"]);
	yield* close();
	expect(runtimeLifecycle()).toEqual(["acquired", "disposed"]);
});
host.it("propagates ambient services across promise boundaries", [runtimeApplication], function* ({ runtimeValue }) {
	expect(yield* runtimeValue("request")).toBe("request");
});
host.it("shares development runtimes by an explicit cache key", [runtimeApplication], function* ({ developmentRuntimes }) {
	expect(yield* developmentRuntimes()).toBe(true);
});
host.it("rejects runPromise with the original typed failure", [runtimeApplication], function* ({ runtimeFailure }) {
	expect(yield* runtimeFailure()).toBe(true);
});
host.it("contextEffect includes request services without retaining them for the next request", [runtimeApplication], function* ({ runtimeValue }) {
	expect(yield* runtimeValue("request-context", true)).toBe("request-context");
	expect(yield* runtimeValue(undefined, true)).toBe("base");
});
host.it("does not reuse development cache entries in production", [runtimeApplication], function* ({ productionRuntimes }) {
	expect(yield* productionRuntimes()).toBe("distinct");
});
