import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { dispatchApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { localBoardHost } from "#test/localBoardHost.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

function source(text: string) {
	return task("one", "approved", "Use repository fixtures.").replace(
		"kind: task",
		`kind: task\ncriteria:\n  - id: build\n    text: Build passes.\n  - id: evidence\n    text: ${text}`,
	);
}

test("Cloud dispatch publishes a local-only criterion decision before session start and accepts an edited criterion", () =>
	withHost({}, { provider: "cloud" }, (fixture) => {
		const local = localBoardHost(fixture);
		local.write(source("Measure documents in private/board/notes."));
		return Effect.gen(function* () {
			const blocked = (yield* dispatchApproved(local.host, "one")).value;
			expect(blocked).toMatchObject({
				attempts: [],
				decision: { attentionOwner: "orchestrator" },
				decisionPublished: true,
				stage: "needs-human",
			});
			expect(blocked.decision?.reason).toContain("evidence");
			expect(blocked.decision?.reason).toContain("private/board");
			expect(blocked.decision?.reason).toContain("Cloud workers cannot read local-only Board data");
			expect(fixture.provider.launched).toHaveLength(0);
			const published = blocked.decision?.published;
			expect(published).toBeDefined();
			const decision = readFileSync(join(local.host.boardDir, published?.sourcePath ?? "missing"), "utf8");
			expect(decision).toContain(blocked.decision?.reason);
			expect(decision).toContain('"response_from":["orchestrator"]');
			local.write(source("Measure repository fixtures."));
			const launched = (yield* dispatchApproved(local.host, "one")).value;
			expect(launched.stage).toBe("executing");
			expect(launched.decision).toBeUndefined();
			expect(fixture.provider.launched).toHaveLength(1);
		}).pipe(Effect.provide(hostLayer(local.host, local.parts)));
	}));

for (const scenario of [
	{ name: "criterion without the local-only path", text: "Measure repository fixtures." },
	{ body: "Read private/board/notes for context.", name: "path mentioned only in the body", text: "Build passes." },
	{ ignored: false, name: "Board directory is not ignored" },
	{ inside: false, name: "Board directory is outside the repository" },
	{ name: "worker runs locally", provider: "local" as const },
]) {
	test(`dispatch launches when ${scenario.name}`, () =>
		withHost({}, { provider: scenario.provider ?? "cloud" }, (fixture) => {
			const local = localBoardHost(fixture, scenario);
			local.write(source(scenario.text ?? "Measure private/board/notes.") + (scenario.body ?? ""));
			return Effect.gen(function* () {
				const launched = (yield* dispatchApproved(local.host, "one")).value;
				expect(launched.stage).toBe("executing");
				expect(launched.decision).toBeUndefined();
				expect(fixture.provider.launched).toHaveLength(1);
			}).pipe(Effect.provide(hostLayer(local.host, local.parts)));
		}));
}
