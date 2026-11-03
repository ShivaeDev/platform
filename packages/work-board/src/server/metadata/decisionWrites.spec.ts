import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { DECISION_SOURCE, MULTIPLE_REQUESTS_SOURCE, TASK_SOURCE } from "#test/headlessWorkspaceFixture.ts";
import { headlessWorkspaceStory, workspaceFiles } from "#test/headlessWorkspaceStory.ts";

const decision = workspaceFiles({ "decision.md": DECISION_SOURCE, "task.md": TASK_SOURCE });

headlessWorkspaceStory.it(
	"decision closure preserves unknown fields and the options and rationale",
	[decision],
	function* ({ closeDecision, metadata }) {
		const original = yield* metadata("decision.md");

		const result = yield* closeDecision(original.source, "direction", "Continue with the selected direction");

		yield* outcomes([
			["save outcome", () => Effect.succeed(result), "saved"],
			[
				"saved decision and rationale",
				() => metadata("decision.md"),
				{
					parsed: { body: original.parsed.body },
					values: {
						attention: [{ custom: "keep this too", id: "direction", state: "closed" }],
						custom: { tracking: ["one", "two"] },
						"next_action": "Continue with the selected direction",
						status: "done",
					},
				},
			],
		]);
	},
);

headlessWorkspaceStory.it(
	"decision closure refuses a missing request without changing the decision",
	[decision],
	function* ({ closeDecision, metadata }) {
		const original = yield* metadata("decision.md");

		const result = yield* closeDecision(original.source, "absent");

		yield* outcomes([
			["closure refusal", () => Effect.succeed(result), "invalid metadata: The decision request is missing or ambiguous."],
			["unchanged decision", () => metadata("decision.md"), { source: original.source }],
		]);
	},
);

headlessWorkspaceStory.it(
	"closing one request keeps another decision request open and the question unfinished",
	[workspaceFiles({ "decision.md": MULTIPLE_REQUESTS_SOURCE })],
	function* ({ closeDecision, metadata }) {
		const original = yield* metadata("decision.md");

		const result = yield* closeDecision(original.source);

		yield* outcomes([
			["save outcome", () => Effect.succeed(result), "saved"],
			[
				"remaining decision",
				() => metadata("decision.md"),
				{
					values: {
						attention: [
							{ id: "direction", state: "closed" },
							{ id: "followup", state: "open" },
						],
						status: "blocked",
					},
				},
			],
		]);
	},
);
