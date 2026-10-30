import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deeplyNested, publicFailures } from "#test/app-host/publicFailures.ts";
import { host } from "#test/app-host/story.ts";

for (const [shape, payload] of [
	[
		"51 items and 51 fields",
		{
			items: Array.from({ length: 51 }, (_, index) => index),
			nested: null,
			note: "public detail",
			wide: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`field${index}`, `public value ${index}`])),
		},
	],
	["a value nested ten levels deep", { items: [1], nested: deeplyNested(10), note: "public detail", wide: {} }],
	["4,200 characters of text", { items: [1], nested: null, note: "public detail ".repeat(300), wide: {} }],
] as const) {
	host.it(
		`a public failure with ${shape} reaches the wire and the native client intact`,
		[publicFailures],
		function* ({ publicFailure, publicFailureOnTheWire }) {
			yield* outcomes({
				"decoded by the native client": [publicFailure(payload), payload],
				"NDJSON on the wire": [publicFailureOnTheWire(payload), expect.stringContaining(JSON.stringify(payload))],
			});
		},
	);
}
