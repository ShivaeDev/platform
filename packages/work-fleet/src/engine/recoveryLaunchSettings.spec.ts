import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

postgresTests("test")("persists exact worker and reviewer launch inputs, including omitted reviewer settings", () =>
	withEngine({ lostReviewAcknowledgement: true }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const settings = { model: "task-model", serviceTier: "priority" };
			yield* fleet.prepare({
				cwd: "/synthetic",
				launch: settings,
				preparation: prepared({ ownedPaths: ["src/one.ts"], sourcePaths: ["src/one.ts"] }),
				prompt: "Implement one",
				workId: "one",
			});
			const worker = yield* fleet.dispatch("one");
			expect(worker.value.attempts[0]).toMatchObject({ prompt: "Implement one", settings });
			finishWorkers(fixture);
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
			const reviewer = reviewing.value.attempts.at(-1);
			expect(reviewer?.settings).toEqual({});
			expect(reviewer?.prompt).toBe(fixture.starts.at(-1)?.prompt);
			expect(fixture.starts.at(-1)).toMatchObject({ access: "read-only", settings: {} });
			const decisionId = reviewing.value.decision?.id ?? "missing";
			yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "retry"));
			expect((yield* fixture.restart(fleet.reconcile("one"))).value.stage).toBe("completed");
			expect(fixture.launched).toHaveLength(2);
		}),
	),
);
