import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { providerCanReject } from "#test/engineReviewFaultTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { priorityTask, singleSlot } from "#test/priorityWork.ts";

for (const sharedArea of [false, true]) {
	engine.it(
		`normal work launches before earlier prepared low work${sharedArea ? " sharing its area" : ""}`,
		[markdownWork(), singleSlot],
		function* ({ launchedPrompts, prepareWork, schedule, workStages, workState, writeBoardWork }) {
			const metadata = sharedArea ? "areas: [feature]\n" : "";
			writeBoardWork("one.md", priorityTask("one", "low", metadata));
			writeBoardWork("two.md", priorityTask("two", "normal", metadata));
			yield* prepareWork("one");
			yield* prepareWork("two");

			yield* schedule();

			yield* outcomes([
				["two", () => workStages(["two"]), { two: "working" }],
				["one", () => workState("one"), { attempts: 0, step: "queued" }],
				["launched prompts", () => launchedPrompts(), ["Implement two"]],
			]);
		},
	);
}

engine.it(
	"low work fills an idle slot when only low work is prepared",
	[markdownWork(), singleSlot],
	function* ({ launchedPrompts, prepareWork, schedule, workStages, workState, writeBoardWork }) {
		for (const id of ["one", "two"]) {
			writeBoardWork(`${id}.md`, priorityTask(id, "low"));
			yield* prepareWork(id);
		}

		yield* schedule();

		yield* outcomes([
			["one", () => workStages(["one"]), { one: "working" }],
			["two", () => workState("two"), { attempts: 0, step: "queued" }],
			["launched prompts", () => launchedPrompts(), ["Implement one"]],
		]);
	},
);

engine.it(
	"running low work keeps its turn when normal work arrives",
	[markdownWork(), singleSlot],
	function* ({ get, launchedPrompts, prepareWork, schedule, workState, writeBoardWork }) {
		writeBoardWork("one.md", priorityTask("one", "low"));
		yield* prepareWork("one");
		yield* schedule();
		const running = (yield* get("one")).value;
		expect(running.step).toBe("working");
		writeBoardWork("two.md", priorityTask("two", "normal"));
		yield* prepareWork("two");

		yield* schedule();

		yield* outcomes([
			["one", () => get("one"), { value: { attempts: [{ receipt: running.attempts[0]?.receipt, status: "running" }], step: "working" } }],
			["two", () => workState("two"), { attempts: 0, step: "queued" }],
			["launched prompts", () => launchedPrompts(), ["Implement one"]],
		]);
	},
);

engine.it("low work waits for its dependencies and held areas", [markdownWork()], function* ({ prepareWork, schedule, workState, writeBoardWork }) {
	writeBoardWork("one.md", priorityTask("one", "normal", "areas: [feature]\n"));
	writeBoardWork("two.md", priorityTask("two", "low", "areas: [feature]\n"));
	writeBoardWork("three.md", priorityTask("three", "low", "relationships:\n  - kind: depends_on\n    target: one\n"));
	for (const id of ["one", "two", "three"]) {
		yield* prepareWork(id);
	}

	yield* schedule();

	yield* outcomes([
		["one", () => workState("one"), { step: "working" }],
		["two", () => workState("two"), { attempts: 0, blocker: "waiting for area feature held by one", step: "queued" }],
		["three", () => workState("three"), { attempts: 0, blocker: expect.stringContaining("waiting for dependency one"), step: "queued" }],
	]);
});

engine.it(
	"a low launch retry stays behind newly prepared normal work",
	[markdownWork(), singleSlot, providerCanReject],
	function* ({ advanceTime, get, launchedPrompts, prepareWork, recoverProvider, rejectProvider, schedule, workStages, writeBoardWork }) {
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

		yield* outcomes([
			["stages", () => workStages(["one", "two"]), { one: "queued", two: "working" }],
			["launched prompts", () => launchedPrompts(), ["Implement one", "Implement two"]],
		]);
	},
);
