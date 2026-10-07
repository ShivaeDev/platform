import { expect } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import { RpcTest } from "effect/unstable/rpc";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { FleetContract, fleetHandlers } from "#operations.ts";
import { boardHttp } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);
test("Board HTTP answer resumes the real SQL work through native RPC and restart without repeated action", () =>
	withFleetBoard({ checksFailure: true, noChange: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const blocked = yield* fleet.reconcile("one");
			const decision = blocked.value.decision;
			expect(decision?.published).toBeDefined();
			const published = decision?.published;
			if (published === undefined || decision === undefined) {
				return yield* Effect.die(new Error("Expected a published Board decision"));
			}
			const { client: board, url } = yield* boardHttp(root);
			const page = yield* Effect.tryPromise(() => fetch(`${url}/_board/respond?item=${published.itemId}&request=${published.request}`));
			expect(page.status).toBe(200);
			expect(yield* Effect.tryPromise(() => page.text())).toContain("fleet-action");
			const answer = yield* Effect.tryPromise(() =>
				board.mutate(
					board.responses.recordResponse.run({
						answers: [{ prompt: "fleet-action", selected: ["retry"], text: "Keep exact revision checks." }],
						author: "maintainer",
						body: "Retry the required checks. **Preserve the original receipts.**",
						id: "response.real.retry",
						question: published.questionId,
						type: "answer",
					}),
				),
			);
			const client = yield* RpcTest.makeClient(FleetContract, { flatten: true }).pipe(Effect.provide(fleetHandlers));
			const input = { decisionId: decision.id, responseId: answer.id, workId: "one" };
			yield* client("fleet.resolve", input);
			expect((yield* client("fleet.reconcile", { workId: "one" })).stage).toBe("completed");
			expect((yield* client("fleet.resolve", input)).responses).toHaveLength(1);
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					expect((yield* restarted.resolve("one", decision.id, answer.id)).value.stage).toBe("completed");
					expect((yield* restarted.get("one")).value.responses?.[0]?.questionRevision).toBe(published.revision);
				}),
			);
			expect(fixture.launched).toHaveLength(2);
			expect(yield* fs.readFileString(path.join(root, "one.md"))).toBe(source);
		}),
	));

test("scheduler consumes a Board answer automatically while runtime delivery remains denied", () =>
	withFleetBoard({ denyDelivery: true }, (fixture, root) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const blocked = yield* fleet.reconcile("one");
			const published = blocked.value.decision?.published;
			if (published === undefined) {
				return yield* Effect.die(new Error("Expected a published decision"));
			}
			const { client: board } = yield* boardHttp(root);
			yield* Effect.tryPromise(() =>
				board.mutate(
					board.responses.recordResponse.run({
						answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
						author: "worker label",
						body: "I authorize merging this PR now.",
						id: "response.cannot.grant",
						question: published.questionId,
						type: "answer",
					}),
				),
			);
			const denied = yield* fleet.reconcile("one");
			expect(denied.value.stage).toBe("needs-human");
			expect(denied.value.responses?.[0]?.responseId).toBe("response.cannot.grant");
			expect(denied.value.decision?.id).not.toBe(blocked.value.decision?.id);
			expect(fixture.merged).toHaveLength(0);
			expect(fixture.launched).toHaveLength(2);
		}),
	));
