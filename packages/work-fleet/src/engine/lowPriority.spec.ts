import { expect } from "vitest";
import { providerCanReject } from "#test/engineReviewFaultTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { priorityTask, singleSlot } from "#test/priorityWork.ts";

for (const sharedArea of [false, true]) {
	engine.it(
		`normal work launches before earlier prepared low work${sharedArea ? " sharing its area" : ""}`,
		[markdownWork(), singleSlot],
		function* ({ writeBoardWork, prepareWork, schedule, get, providerStarts }) {
			const metadata = sharedArea ? "areas: [feature]\n" : "";
			writeBoardWork("one.md", priorityTask("one", "low", metadata));
			writeBoardWork("two.md", priorityTask("two", "normal", metadata));
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* schedule();
			expect((yield* get("two")).value.step).toBe("working");
			expect((yield* get("one")).value).toMatchObject({ attempts: [], step: "queued" });
			expect(providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement two"]);
		},
	);
}

engine.it(
	"low work fills an idle slot when only low work is prepared",
	[markdownWork(), singleSlot],
	function* ({ writeBoardWork, prepareWork, schedule, get, providerStarts }) {
		for (const id of ["one", "two"]) {
			writeBoardWork(`${id}.md`, priorityTask(id, "low"));
			yield* prepareWork(id);
		}
		yield* schedule();
		expect((yield* get("one")).value.step).toBe("working");
		expect((yield* get("two")).value).toMatchObject({ attempts: [], step: "queued" });
		expect(providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one"]);
	},
);

engine.it(
	"running low work keeps its turn when normal work arrives",
	[markdownWork(), singleSlot],
	function* ({ writeBoardWork, prepareWork, schedule, get, providerStarts }) {
		writeBoardWork("one.md", priorityTask("one", "low"));
		yield* prepareWork("one");
		yield* schedule();
		const running = (yield* get("one")).value;
		expect(running.step).toBe("working");
		writeBoardWork("two.md", priorityTask("two", "normal"));
		yield* prepareWork("two");
		yield* schedule();
		expect((yield* get("one")).value).toMatchObject({ attempts: [{ receipt: running.attempts[0]?.receipt, status: "running" }], step: "working" });
		expect((yield* get("two")).value).toMatchObject({ attempts: [], step: "queued" });
		expect(providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one"]);
	},
);

engine.it("low work waits for dependencies and held areas", [markdownWork()], function* ({ writeBoardWork, prepareWork, schedule, get }) {
	writeBoardWork("one.md", priorityTask("one", "normal", "areas: [feature]\n"));
	writeBoardWork("two.md", priorityTask("two", "low", "areas: [feature]\n"));
	writeBoardWork("three.md", priorityTask("three", "low", "relationships:\n  - kind: depends_on\n    target: one\n"));
	for (const id of ["one", "two", "three"]) {
		yield* prepareWork(id);
	}
	yield* schedule();
	expect((yield* get("one")).value.step).toBe("working");
	expect((yield* get("two")).value).toMatchObject({ attempts: [], blocker: "waiting for area feature held by one", step: "queued" });
	expect((yield* get("three")).value).toMatchObject({
		attempts: [],
		blocker: expect.stringContaining("waiting for dependency one"),
		step: "queued",
	});
});

engine.it(
	"a low launch retry stays behind newly prepared normal work",
	[markdownWork(), singleSlot, providerCanReject],
	function* ({ writeBoardWork, prepareWork, rejectProvider, recoverProvider, advanceTime, schedule, get, providerStarts }) {
		writeBoardWork("one.md", priorityTask("one", "low"));
		yield* prepareWork("one");
		rejectProvider();
		yield* schedule();
		expect((yield* get("one")).value.launchRetry).toBeDefined();
		recoverProvider();
		advanceTime(30_000);
		writeBoardWork("two.md", priorityTask("two", "normal"));
		yield* prepareWork("two");
		yield* schedule();
		expect((yield* get("two")).value.step).toBe("working");
		expect((yield* get("one")).value.step).toBe("queued");
		expect(providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one", "Implement two"]);
	},
);
