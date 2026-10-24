import { expect } from "@effect/vitest";
import { criterionSource } from "#test/criterionSource.ts";
import { localBoard } from "#test/hostScenarioTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";

for (const cli of [false, true]) {
	host.it(
		`${cli ? "CLI" : "Cloud"} dispatch accepts an edited criterion after publishing a local-only criterion decision before session start`,
		[boardWork({ "one.md": criterionSource("Measure documents in private/board/notes.") }, { provider: "cloud" }), localBoard()],
		function* (daemon) {
			if (cli) {
				expect((yield* daemon.cli(["dispatch", "one"])).code).toBe(0);
			} else {
				yield* daemon.approve("one");
			}
			const blocked = yield* daemon.waitForRecord("one", (record) => record.step === "waiting" && record.decisionPublished === true);
			expect(blocked).toMatchObject({ attempts: [], decision: { attentionOwner: "orchestrator" }, decisionPublished: true, step: "waiting" });
			expect(blocked.decision?.reason).toContain("evidence");
			expect(blocked.decision?.reason).toContain("private/board");
			expect(blocked.decision?.reason).toContain("Cloud workers cannot read local-only Board data");
			expect(daemon.providerLaunches()).toHaveLength(0);
			const published = blocked.decision?.published;
			if (published === undefined) {
				throw new Error("Missing local-only criterion decision");
			}
			const decision = daemon.readBoard(published.sourcePath);
			expect(decision).toContain(blocked.decision?.reason);
			expect(decision).toContain('"response_from":["orchestrator"]');
			daemon.writeBoard("one.md", criterionSource("Measure repository fixtures."));
			if (cli) {
				expect(yield* daemon.cli(["dispatch", "one"])).toMatchObject({
					code: 0,
					stdout: expect.stringContaining("dispatch recorded; preparing and launching in the background"),
				});
			} else {
				yield* daemon.approve("one");
			}
			const launched = yield* daemon.waitForRecord("one", (record) => record.step === "working" && record.attempts[0]?.receipt !== undefined);
			expect(launched.decision).toBeUndefined();
			expect(launched.boardContext).toContain("Measure repository fixtures.");
			expect(daemon.providerLaunches()).toHaveLength(1);
			expect(daemon.providerObservations()[0]?.output).toContain("Measure repository fixtures.");
		},
	);
}
for (const scenario of [
	{ name: "criterion without the local-only path", text: "Measure repository fixtures." },
	{ name: "criterion naming a longer path that starts with the local-only path", text: "Exclude private/boardroom and xprivate/board copies." },
	{ body: "Read private/board/notes for context.", name: "path mentioned only in the body", text: "Build passes." },
	{ ignored: false, name: "Board directory is not ignored" },
	{ inside: false, name: "Board directory is outside the repository" },
	{ name: "worker runs locally", provider: "local" as const },
]) {
	host.it(
		`dispatch launches when ${scenario.name}`,
		[
			boardWork(
				{ "one.md": criterionSource(scenario.text ?? "Measure private/board/notes.") + (scenario.body ?? "") },
				{ provider: scenario.provider ?? "cloud" },
			),
			localBoard(scenario),
		],
		function* (daemon) {
			const launched = (yield* daemon.approve("one")).value;
			expect(launched.step).toBe("working");
			expect(launched.decision).toBeUndefined();
			expect(daemon.providerLaunches()).toHaveLength(1);
		},
	);
}
