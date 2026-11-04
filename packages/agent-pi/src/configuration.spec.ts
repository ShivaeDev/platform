import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { constrained, noCredentials, piAgent } from "#test/piStory.ts";

piAgent.it("model listing and selection use the credentialed catalog", [], function* ({ models, start, requests }) {
	expect(yield* models()).toMatchObject([{ id: "acme/fast", isDefault: true, name: "Fast (acme)" }]);

	yield* start("alice", "work", "acme/fast", "high");

	expect(yield* requests()).toMatchObject([{ model: "fast", thinkingLevel: "high" }]);
});

piAgent.it("a model without credentials is refused before opening a session", [noCredentials], function* ({ start, result, requests }) {
	yield* start("alice", "work", "acme/fast");

	yield* outcomes([
		["submission", () => result("alice"), "rejected: Pi offers no model acme/fast with credentials; choose provider/model-id from its catalog"],
		["provider requests", () => requests(), []],
	]);
});

piAgent.it("unsupported thinking effort is refused before opening a session", [], function* ({ start, result, requests }) {
	yield* start("alice", "work", undefined, "turbo");

	yield* outcomes([
		[
			"submission",
			() => result("alice"),
			"rejected: effort turbo is not a thinking level Pi offers; choose one of off, minimal, low, medium, high, xhigh, max",
		],
		["provider requests", () => requests(), []],
	]);
});

for (const feature of ["imageInput", "transcript"] as const) {
	piAgent.it(`${feature} remains an explicit negotiation refusal`, [], function* ({ negotiate }) {
		expect(yield* negotiate(feature)).toMatchObject({ reason: expect.any(String), support: "unsupported" });
	});
}

piAgent.it("ordinary sessions reload resources with the application's additional skills", [], function* ({ start, resources }) {
	yield* start("alice", "work");

	expect(yield* resources()).toMatchObject([{ options: { additionalSkillPaths: [expect.stringMatching(/skills$/u)] }, reloaded: true }]);
});

piAgent.it(
	"constrained sessions disable discovered resources and use an empty tool allowlist",
	[constrained],
	function* ({ connect, start, resources, requests }) {
		yield* connect();
		yield* start("alice", "work");

		yield* outcomes([
			[
				"resource discovery",
				() => resources(),
				[
					{
						options: {
							noContextFiles: true,
							noExtensions: true,
							noPromptTemplates: true,
							noSkills: true,
							noThemes: true,
							systemPrompt: "Only this job.",
						},
						reloaded: true,
					},
				],
			],
			["tool allowlist", () => requests(), [{ prompts: [{ text: "work" }], tools: [] }]],
		]);
	},
);

piAgent.it("an omitted model selects the first credentialed model", [], function* ({ start, requests }) {
	yield* start("alice", "work");

	expect(yield* requests()).toMatchObject([{ model: "fast" }]);
});

piAgent.it("text parts reach Pi joined by newlines", [], function* ({ start, requests }) {
	yield* start("alice", ["first", "second"]);

	expect(yield* requests()).toMatchObject([{ prompts: [{ text: "first\nsecond" }] }]);
});
