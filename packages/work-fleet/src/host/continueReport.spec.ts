import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const SOURCE = "---\nid: research\nkind: task\nfleet: approved\nfleet-deliverable: report\n---\n# Research\n";
const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("manual continuation archives a completed report and adopts the continued report turn", function* () {
	yield* withHost({ "research.md": SOURCE }, {}, (fixture) =>
		Effect.gen(function* () {
			yield* dispatchWork(fixture.host, "research", fixture.parts);
			for (const [id, current] of fixture.provider.observations) {
				fixture.provider.observations.set(id, { ...current, execution: "completed", output: "Original findings." });
			}
			const execution = Effect.gen(function* () {
				const fleet = yield* Fleet;
				const original = yield* fleet.reconcile("research");
				expect(original.value.stage).toBe("completed");
				const continued = yield* fleet.continue("research", "Check the remaining evidence");
				expect(continued.value.stage).toBe("executing");
				expect(continued.value.report).toBeUndefined();
				expect(continued.value.history?.[0]?.report).toEqual(original.value.report);
				const attempt = continued.value.attempts[0];
				expect(attempt?.prompt).toContain("Check the remaining evidence");
				expect(attempt?.prompt).toContain("Leave repository sources unchanged. Commit nothing, push nothing, and open no PR");
				const receipt = attempt?.receipt;
				if (receipt === undefined) {
					return yield* Effect.die(new Error("Expected a continued report receipt"));
				}
				expect(receipt.sessionId).toBe(original.value.report?.receipt.sessionId);
				expect(receipt.turnId).not.toBe(original.value.report?.receipt.turnId);
				const observation = fixture.provider.observations.get(receipt.turnId);
				if (observation === undefined) {
					return yield* Effect.die(new Error("Expected the continued report observation"));
				}
				fixture.provider.observations.set(receipt.turnId, { ...observation, execution: "completed", output: "Updated findings." });
				const completed = yield* fleet.reconcile("research");
				expect(completed.value.stage).toBe("completed");
				const report = completed.value.report;
				if (report === undefined) {
					return yield* Effect.die(new Error("Expected the continued report publication"));
				}
				expect(report.receipt).toEqual(receipt);
				expect(report.sourcePath).not.toBe(original.value.report?.sourcePath);
				expect(readFileSync(join(fixture.host.boardDir, report.sourcePath), "utf8").endsWith("Updated findings.")).toBe(true);
				expect(fixture.provider.launched).toHaveLength(1);
			});
			yield* execution.pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
		}),
	);
}, 30_000);
