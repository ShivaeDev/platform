import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { WAIT_EXIT } from "#host/wait.ts";
import { boardHttp } from "#test/boardHttp.ts";
import { task, waitProcess, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { answerWorker, askWorker, QUESTION } from "#test/workerQuestion.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("worker questions appear on Board, wait exits needs-human, and an answer continues the thread once across restart", function* () {
	yield* withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
		Effect.gen(function* () {
			yield* dispatchWork(fixture.host, "one", fixture.parts);
			const { decision, published, stopped } = yield* askWorker(fixture.provider).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			expect(stopped.value.stage).toBe("needs-human");
			expect(stopped.value.result).toBeUndefined();
			const { url } = yield* boardHttp(fixture.host.boardDir);
			const page = yield* Effect.tryPromise(() => fetch(`${url}/_board/respond?item=${published.itemId}&request=${published.request}`));
			expect(page.status).toBe(200);
			const html = yield* Effect.tryPromise(() => page.text());
			expect(html).toContain("Which storage should I use?");
			expect(html).not.toContain("fleet-action");
			const overview = yield* Effect.tryPromise(() => fetch(`${url}/_board/overview`).then((response) => response.text()));
			expect(overview).toContain(`data-attention-item="${published.itemId}" data-request="${published.request}"`);
			expect(overview).toContain("one");
			expect(yield* Effect.promise(() => waitProcess(fixture.configFile, "one"))).toEqual({
				code: WAIT_EXIT.needsHuman,
				stdout: `one needs-human (waiting on orchestrator): ${QUESTION}`,
			});
			const answer = yield* answerWorker(fixture.host.boardDir, decision);
			const resumed = yield* Effect.gen(function* () {
				const fleet = yield* Fleet;
				return yield* fleet.reconcile("one");
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			expect(resumed.value.stage).toBe("executing");
			expect(resumed.value.attempts).toHaveLength(2);
			expect(resumed.value.responses).toMatchObject([{ action: "continue", boardAcknowledged: true, responseId: answer.id }]);
			const continuation = resumed.value.attempts.at(-1);
			expect(continuation?.receipt?.sessionId).toBe(decision.worker?.sessionId);
			expect(continuation?.prompt).toBe(answer.body);
			expect(fixture.provider.observations.get(continuation?.receipt?.turnId ?? "")?.output).toBe(answer.body);
			yield* Effect.gen(function* () {
				const restarted = yield* Fleet;
				yield* restarted.resolve("one", decision.id, answer.id);
				yield* restarted.reconcile("one");
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			expect(fixture.provider.launched).toHaveLength(1);
			expect(fixture.provider.settings.filter((call) => call.call === "turn")).toHaveLength(2);
		}),
	);
}, 30_000);
