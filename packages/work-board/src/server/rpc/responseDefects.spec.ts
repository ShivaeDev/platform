import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aQuestionnaire, boardStory } from "#test/boardStory.ts";
import { crashableTracedBoard } from "#test/liveTraits.ts";

for (const [kind, operation] of [
	["question", "work-board-responses.question"],
	["handoff source", "work-board-handoffs.handoffSource"],
] as const) {
	boardStory.it(
		`a ${kind} storage defect is masked over RPC while its server span keeps the original defect`,
		[aQuestionnaire(), crashableTracedBoard("proposal.md")],
		function* ({ responseRejection, serverSpanCause, storageCrashes }) {
			expect(yield* responseRejection(kind, "investigation.choices")).toBe("answered");

			storageCrashes();

			yield* outcomes([
				[
					"the client",
					() => responseRejection(kind, "investigation.choices"),
					{ answer: "internal server error", cause: "none", secret: "withheld" },
				],
				["the server span", () => serverSpanCause(operation), ["internal server error carrying the original defect"]],
			]);
		},
	);
}
