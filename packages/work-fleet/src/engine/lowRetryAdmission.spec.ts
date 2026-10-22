import { expect } from "vitest";
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
		expect((yield* get("two")).value).toMatchObject({
			attempts: [],
			blocker: expect.stringContaining("waiting for dependency three"),
			step: "queued",
		});
		expect((yield* get("three")).value.step).toBe("working");
		expect((yield* get("one")).value).toMatchObject({ launchRetry: lowRetry, step: "queued" });
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
		expect((yield* get("three")).value.launchRetry).toMatchObject({ rejections: 1 });
		expect((yield* get("four")).value).toMatchObject({ attempts: [], step: "queued" });
		expect((yield* get("one")).value.launchRetry).toEqual(lowRetry);
		expect(providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one", "Implement three"]);
	},
);
