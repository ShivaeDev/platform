import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { providerCanReject } from "#test/engineReviewFaultTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { priorityTask, singleSlot } from "#test/priorityWork.ts";

engine.it(
	"a waiting low retry lets normal B launch behind normal A that depends on B",
	[markdownWork(), singleSlot, providerCanReject],
	function* ({ writeBoardWork, prepareWork, rejectProvider, recoverProvider, advanceTime, schedule, get, providerStarts }) {
		writeBoardWork("one.md", priorityTask("one", "low"));
		yield* prepareWork("one");
		rejectProvider();
		yield* schedule();
		const lowRetry = (yield* get("one")).value.launchRetry;
		expect(lowRetry).toBeDefined();
		recoverProvider();
		advanceTime(30_000);
		writeBoardWork("two.md", priorityTask("two", "normal", "relationships:\n  - kind: depends_on\n    target: three\n"));
		writeBoardWork("three.md", priorityTask("three", "normal"));
		yield* prepareWork("two");
		yield* prepareWork("three");
		yield* schedule();
		yield* outcomes([
			[
				"two",
				() => get("two"),
				{
					value: {
						attempts: [],
						blocker: expect.stringContaining("waiting for dependency three"),
						step: "queued",
					},
				},
			],
			["three step", () => get("three"), { value: { step: "working" } }],
			["one", () => get("one"), { value: { launchRetry: lowRetry, step: "queued" } }],
		]);
		expect(providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one", "Implement three"]);
	},
);

engine.it(
	"a new normal rejection stops later admission even with a preexisting low retry",
	[markdownWork(), singleSlot, providerCanReject],
	function* ({ writeBoardWork, prepareWork, rejectProvider, advanceTime, schedule, get, providerStarts }) {
		writeBoardWork("one.md", priorityTask("one", "low"));
		yield* prepareWork("one");
		rejectProvider();
		yield* schedule();
		const lowRetry = (yield* get("one")).value.launchRetry;
		expect(lowRetry).toBeDefined();
		advanceTime(30_000);
		writeBoardWork("two.md", priorityTask("two", "normal", "relationships:\n  - kind: depends_on\n    target: three\n"));
		for (const id of ["three", "four"]) {
			writeBoardWork(`${id}.md`, priorityTask(id, "normal"));
		}
		for (const id of ["two", "three", "four"]) {
			yield* prepareWork(id);
		}
		yield* schedule();
		yield* outcomes([
			["three launch retry", () => get("three"), { value: { launchRetry: { rejections: 1 } } }],
			["four", () => get("four"), { value: { attempts: [], step: "queued" } }],
			["one launch retry", () => get("one"), { value: { launchRetry: lowRetry } }],
		]);
		expect(providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one", "Implement three"]);
	},
);
