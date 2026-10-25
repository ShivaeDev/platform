import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { liveStreams } from "#test/liveStreams.ts";

liveStreams.it("resync reports only acquired streams whose scopes remain open", [], function* ({ open, resync }) {
	expect(yield* resync()).toBe(0);
	const first = yield* open();
	const second = yield* open();
	const closed = yield* open();
	yield* eventually(Effect.try(() => expect(closed.hints).toEqual([{ _tag: "Resync" }])));
	expect(yield* resync()).toBe([first, second, closed].length);
	yield* eventually(Effect.try(() => expect(closed.hints).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }])));
	yield* closed.close;
	expect(yield* resync()).toBe([first, second].length);
	yield* eventually(
		Effect.try(() => {
			expect(first.hints).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }, { _tag: "Resync" }]);
			expect(second.hints).toEqual(first.hints);
		}),
	);
	expect(closed.hints).toEqual([{ _tag: "Resync" }, { _tag: "Resync" }]);
});
