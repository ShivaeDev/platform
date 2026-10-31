import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { lanes } from "#test/attentionLaneTraits.ts";
import { boardStory } from "#test/boardStory.ts";
import { responseRecords } from "#test/responseRecords.ts";
import { anUnreadableSource } from "#test/storyTraits.ts";

boardStory.it(
	"the inbox puts asks for the maintainer and a person's next action under you and other responders' asks under agents",
	[lanes()],
	function* ({ inboxLane, inboxResponders }) {
		yield* outcomes([
			[
				"agents",
				() => inboxResponders(),
				[
					["decision.orchestrator", ["orchestrator"]],
					["decision.automation", ["automation"]],
				],
			],
			["you", () => inboxLane("you"), ["task.draft", "decision.reader", "question.storage", "task.person"]],
		]);
	},
);

boardStory.it("the inbox reports source diagnostics apart from its lanes", [lanes()], function* ({ sourceProblems }) {
	expect((yield* sourceProblems()).map((problem) => problem.file)).toEqual(["unknown.md", "unresolved.md"]);
});

boardStory.it("the Inbox badge counts the asks waiting on you", [lanes()], function* ({ needsYouBadge }) {
	const waiting = ["task.draft", "decision.reader", "question.storage", "task.person"];
	expect(yield* needsYouBadge()).toBe(waiting.length);
});

boardStory.it(
	"asks for the maintainer and the orchestrator on the same target stay in separate lanes",
	[
		lanes((files) => {
			files["reader.md"] = files["reader.md"]?.replace("managed: true", "managed: false").replace("[maintainer]", "[orchestrator, maintainer]") ?? "";
			files["orchestrator.md"] = files["orchestrator.md"]?.replace("unblocks: [decision.orchestrator]", "unblocks: [decision.reader]") ?? "";
		}, "an unregistered reader ask names the orchestrator and the maintainer, and the orchestrator's ask targets the reader decision"),
	],
	function* ({ inboxLane, inboxResponders }) {
		yield* outcomes([
			[
				"agents",
				() => inboxResponders(),
				[
					["decision.reader", ["orchestrator"]],
					["decision.automation", ["automation"]],
				],
			],
			["you", () => inboxLane("you"), ["task.draft", "decision.reader", "question.storage", "task.person"]],
		]);
	},
);

boardStory.it(
	"an incomplete workspace withholds every lane and the Inbox badge",
	[lanes(), anUnreadableSource("unreadable.md")],
	function* ({ inboxComplete, inboxLane, needsYouBadge }) {
		yield* outcomes([
			["agents", () => inboxLane("agents"), []],
			["badge", () => needsYouBadge(), null],
			["complete", () => inboxComplete(), false],
			["parked", () => inboxLane("parked"), []],
			["resolved", () => inboxLane("resolved"), []],
			["you", () => inboxLane("you"), []],
		]);
	},
);

boardStory.it(
	"a person's next action keeps its reason when an agent's ask targets the same item",
	[
		lanes((files) => {
			files["orchestrator.md"] = files["orchestrator.md"]?.replace("unblocks: [decision.orchestrator]", "unblocks: [task.person]") ?? "";
		}, "the orchestrator's ask targets the person's task"),
	],
	function* ({ inboxAsk, inboxResponders }) {
		yield* outcomes([
			["agents", () => inboxResponders(), expect.arrayContaining([["task.person", ["orchestrator"]]])],
			["person's task", () => inboxAsk("task.person"), expect.objectContaining({ reason: "Read the evidence" })],
		]);
	},
);

for (const { audience, lane, remaining } of [
	{ audience: "reader", lane: "you", remaining: ["task.draft", "question.storage", "task.person"] },
	{ audience: "orchestrator", lane: "agents", remaining: ["decision.automation"] },
] as const) {
	const file = `${audience}.md`;
	const item = `decision.${audience}`;
	function answered(context = "") {
		return lanes(
			(files) => {
				const source = files[file]?.replace("managed: true", "managed: false").replace("id: direction", "id: choose") ?? "";
				Object.assign(files, responseRecords(1, item, file, source), { [file]: `${source}${context}` });
			},
			`the ${audience} ask is ordinary and has a recorded answer${context ? ", and its source changed since" : ""}`,
		);
	}

	boardStory.it(`an answered ordinary ask for the ${audience} leaves the ${lane} lane`, [answered()], function* ({ inboxLane }) {
		expect(yield* inboxLane(lane)).toEqual(remaining);
	});

	boardStory.it(
		`an answered ordinary ask for the ${audience} returns to the ${lane} lane when its source changes`,
		[answered("\nNew context")],
		function* ({ inboxLane }) {
			expect(yield* inboxLane(lane)).toContain(item);
		},
	);
}
