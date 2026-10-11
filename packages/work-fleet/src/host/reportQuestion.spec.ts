import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const SOURCE = "---\nid: one\nkind: task\nfleet: approved\nfleet-deliverable: report\n---\n# Research\n";
const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("report questions continue read-only research and record the final answer turn", function* () {
	yield* withHost({ "one.md": SOURCE }, {}, (fixture) =>
		Effect.gen(function* () {
			yield* dispatchWork(fixture.host, "one", fixture.parts);
			const { decision } = yield* askWorker(fixture.provider).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			yield* answerWorker(fixture.host.boardDir, decision);
			const fleetWork = Effect.gen(function* () {
				const fleet = yield* Fleet;
				const resumed = yield* fleet.reconcile("one");
				const attempt = resumed.value.attempts.at(-1);
				expect(attempt?.prompt).toContain("Use **PostgreSQL**");
				expect(attempt?.prompt).toContain("Leave repository sources unchanged. Commit nothing, push nothing, and open no PR");
				const receipt = attempt?.receipt;
				if (receipt === undefined) {
					return yield* Effect.die(new Error("Expected the report answer turn receipt"));
				}
				expect(receipt.sessionId).toBe(decision.worker?.sessionId);
				const observation = fixture.provider.observations.get(receipt.turnId);
				if (observation === undefined) {
					return yield* Effect.die(new Error("Expected the continued report observation"));
				}
				fixture.provider.observations.set(receipt.turnId, { ...observation, execution: "completed", output: "# Findings after the answer\n" });
				const completed = yield* fleet.reconcile("one");
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.report?.receipt).toEqual(receipt);
				expect(fixture.provider.launched).toHaveLength(1);
				const status = readFileSync(join(fixture.host.boardDir, "fleet/status.md"), "utf8");
				expect(status).toContain("## Done");
				expect(status).toContain("Stage: completed");
			});
			yield* fleetWork.pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
		}),
	);
}, 30_000);
