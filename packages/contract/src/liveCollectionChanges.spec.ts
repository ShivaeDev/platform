import { Schema } from "effect";
import { expect } from "vitest";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { liveHints, watcher } from "#test/liveStreams.ts";

const lines = collection("lines", Schema.Number);
const orders = collection("orders", Schema.Number);

for (const [change, keys, heard] of [
	["every order", ["orders:*"], ["changed orders 5"]],
	["every line", ["lines:*"], ["changed lines 5"]],
	["the lines list", invalidationKeys([lines.list]), ["changed the lines list"]],
] as const) {
	liveHints.it(
		`a change to ${change} reaches a watcher of line 5, the lines list and order 5 as ${heard.join(", ")}`,
		[watcher("the watcher", [lines.item(5), lines.list, orders.item(5)])],
		function* ({ heard: heardBy, invalidate }) {
			yield* invalidate(keys);

			expect(yield* heardBy("the watcher")).toEqual(heard);
		},
	);
}
