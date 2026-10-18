import { Context, Effect, Fiber } from "effect";
import { expect } from "vitest";
import { adapterServices } from "#test/adapterRouter.ts";
import { RuntimeValue } from "#test/adapterServices.ts";
import { inputIs, requestIs, trpc } from "#test/routerStory.ts";

trpc.it("uses middleware context to build request services", [adapterServices(), requestIs("secured")], function* ({ query }) {
	expect(yield* query("authenticated")).toBe("actor:secured");
});
trpc.it(
	"runs generators and instrumentation with runtime and request services",
	[adapterServices()],
	function* ({ query, instrumented, instrumentedRequests }) {
		expect(yield* query("services")).toEqual({ requestValue: "request-1", runtimeOnlyValue: "runtime-only", runtimeValue: "runtime" });
		expect(instrumented).toContainEqual({ path: "services", type: "query" });
		expect(instrumentedRequests).toContain("request-1");
	},
);
trpc.it("decodes input and output schemas", [adapterServices(), inputIs({ value: "4" })], function* ({ query }) {
	expect(yield* query("decodedInput")).toBe(5);
	expect(yield* query("transformedOutput")).toBe(42);
});
trpc.it("builds mutations", [adapterServices(), inputIs("changed")], function* ({ mutate }) {
	expect(yield* mutate("mutation")).toBe("CHANGED");
});
trpc.it(
	"runs subscriptions as scoped Effect streams",
	[adapterServices(), requestIs("stream")],
	function* ({ consume, finalized, instrumentedStreams }) {
		expect(yield* consume("stream")).toEqual(["stream:one", "stream:two", "undefined"]);
		expect(finalized).toContain("stream");
		expect(instrumentedStreams).toContainEqual({ path: "stream", type: "subscription" });
	},
);
trpc.it("decodes subscription output schemas", [adapterServices()], function* ({ consume }) {
	expect(yield* consume("transformedStream")).toEqual([42, 43]);
});
trpc.it("interrupts subscriptions and runs finalizers on caller abort", [adapterServices()], function* ({ subscribe, next, started, finalized }) {
	const controller = new AbortController();
	const iterator = yield* subscribe("interruptible", controller.signal);
	const pending = yield* Effect.forkChild(next(iterator));
	yield* started();
	controller.abort();
	expect(yield* Fiber.join(pending)).toEqual({ done: true, value: undefined });
	expect(finalized).toContain("interruptible");
});
trpc.it("passes explicit transport errors through", [adapterServices()], function* ({ rejectQuery }) {
	expect(yield* rejectQuery("explicitFailure")).toMatchObject({ data: { code: "NOT_FOUND" }, message: "missing" });
});
trpc.it("extends request services from the base Layer", [adapterServices(), requestIs("request-2")], function* ({ query }) {
	expect(yield* query("extendedServices")).toEqual({ base: "request-2", extended: "extended:request-2" });
});
trpc.it("maps failures from procedures and request Layers", [adapterServices()], function* ({ rejectQuery, mapped }) {
	expect(yield* rejectQuery("domainFailure")).toMatchObject({ data: { code: "CONFLICT" }, message: "domain conflict" });
	expect(yield* rejectQuery("layerFailure")).toMatchObject({ data: { code: "CONFLICT" }, message: "layer conflict" });
	expect(mapped).toContainEqual(expect.objectContaining({ origin: "failure", path: "domainFailure" }));
	expect(mapped).toContainEqual(expect.objectContaining({ origin: "failure", path: "layerFailure" }));
});
for (const path of ["unknownDefect", "layerDefect"]) {
	trpc.it(`redacts ${path} and maps its cause`, [adapterServices()], function* ({ rejectQuery, mapped }) {
		expect(yield* rejectQuery(path)).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" }, message: "Internal server error" });
		expect(mapped).toContainEqual(expect.objectContaining({ origin: "defect", path }));
	});
}
trpc.it("merges ambient overrides over the application runtime", [adapterServices(), requestIs("ambient")], function* ({ callerQuery }) {
	expect(yield* callerQuery("services", Context.make(RuntimeValue, "override"))).toEqual({
		requestValue: "ambient",
		runtimeOnlyValue: "runtime-only",
		runtimeValue: "override",
	});
});
