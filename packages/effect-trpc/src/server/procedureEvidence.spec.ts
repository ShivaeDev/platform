import { Effect, Option } from "effect";
import { expect } from "vitest";
import { procedureEvidence } from "#test/procedureEvidence.ts";

procedureEvidence.it("records one procedure span with attributes and a resolver child for every procedure kind", [], function* (caller) {
	expect(yield* caller.read()).toBe("read");
	expect(yield* caller.write()).toBe("written");
	expect(yield* caller.updates()).toEqual(["first", "second"]);
	for (const [path, kind] of [
		["orders.read", "query"],
		["orders.write", "mutation"],
		["orders.updates", "subscription"],
	]) {
		const procedures = caller.spans.filter((span) => span.name === path);
		expect(procedures).toHaveLength(1);
		const procedure = procedures[0];
		expect(procedure?.attributes).toEqual(
			new Map([
				["rpc.method", path],
				["rpc.system", "trpc"],
				["trpc.type", kind],
			]),
		);
		expect(procedure?.status._tag).toBe("Ended");
		const children = caller.spans.filter((span) => span.name === `resolver.${kind}`);
		expect(children).toHaveLength(1);
		expect(children[0] && Option.getOrUndefined(children[0].parent)).toBe(procedure);
	}
});

procedureEvidence.it("provides the caller's signal to the subscription resolver and observes its abort", [], function* (caller) {
	const controller = new AbortController();
	const iterator = yield* caller.signal(controller.signal);
	const first = yield* Effect.promise(() => iterator.next());
	expect(first.done).toBe(false);
	expect(first.value).toBe(controller.signal);
	expect(first.value?.aborted).toBe(false);
	controller.abort();
	expect(first.value?.aborted).toBe(true);
	expect(yield* Effect.promise(() => iterator.next())).toEqual({ done: true, value: undefined });
	expect(caller.aborted).toEqual([true]);
});
