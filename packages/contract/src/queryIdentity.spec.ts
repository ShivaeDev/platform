import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { automaticResume, resumeStory } from "#test/resumeStory.ts";

resumeStory.it(
	"preparing a query does not subscribe and a mounted query keeps its subscription across collection",
	[automaticResume("native")],
	function* (test) {
		test.connect();
		test.prepare(1);
		expect(test.connections()).toBe(0);
		yield* test.collectGarbage();
		const release = test.watch(1);
		yield* test.loaded(1);
		yield* eventually(Effect.try(() => expect(test.connections()).toBeGreaterThan(0)));
		const opened = test.connections();
		yield* test.collectGarbage();
		expect(test.connections()).toBe(opened);
		release();
	},
);
