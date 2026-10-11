import { execFileSync } from "node:child_process";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import type { BoardDecision } from "#board/schema.ts";
import { Fleet } from "#fleet.ts";
import { dispatchWork, hostLayer } from "#host/commands.ts";
import { boardHttpFiles, boardInbox, boardOverview } from "#test/boardHttp.ts";
import { codexServer } from "#test/codex.ts";
import { finishWorkers } from "#test/engine.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("bulk CLI release closes changed done and deferred decisions and records one response per question", function* () {
	const server = yield* codexServer(() => ({}));
	yield* withHost({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, { local: { endpoint: server.endpoint } }, (fixture) =>
		Effect.gen(function* () {
			execFileSync("git", ["init", "--quiet", "--initial-branch=main", fixture.host.boardDir]);
			const decisions: BoardDecision[] = [];
			for (const [id, status] of [
				["one", "done"],
				["two", "deferred"],
			] as const) {
				yield* dispatchWork(fixture.host, id, fixture.parts);
				const running = yield* Effect.promise(() => cliProcess(["release", id, "--board", fixture.host.boardDir]));
				expect(running.code).toBe(1);
				const published = yield* waitingDecision(fixture, id);
				decisions.push(published);
				fixture.write(`${id}.md`, `---\nid: ${id}\nkind: task\nstatus: ${status}\n---\n# Finished scope\n`);
			}
			for (const [index, published] of decisions.entries()) {
				expect(yield* boardInbox(fixture.host.boardDir, index === 0 ? "orchestrator" : "automation")).toContain(
					`data-key="inbox:${published.sourcePath}"`,
				);
			}
			const args = ["release", "one", "two", "--board", fixture.host.boardDir];
			let errors = "";
			const released = yield* Effect.promise(() =>
				cliProcess(args, {
					onError: (text) => {
						errors += text;
					},
				}),
			);
			expect(released, errors).toEqual({ code: 0, stdout: "one released\ntwo released" });
			expect(yield* boardOverview(fixture.host.boardDir)).not.toContain("data-attention-item=");
			expect(yield* boardInbox(fixture.host.boardDir, "orchestrator")).not.toContain('data-key="inbox:');
			const files = boardHttpFiles(fixture.host.boardDir);
			expect(files.receipts()).toHaveLength(2);
			for (const published of decisions) {
				expect(files.read(`responses/response.fleet-release.${published.questionId}.md`)).toContain("Release Fleet ownership.");
			}
			yield* Effect.gen(function* () {
				const fleet = yield* Fleet;
				for (const id of ["one", "two"]) {
					const current = (yield* fleet.get(id)).value;
					expect(current.stage).toBe("released");
					expect(current.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
				}
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
			expect(yield* Effect.promise(() => cliProcess(args))).toEqual(released);
			expect(files.receipts()).toHaveLength(2);
			expect(fixture.provider.launched).toHaveLength(2);
		}),
	);
});

function waitingDecision(fixture: HostFixture, id: string) {
	return Effect.gen(function* () {
		if (id === "one") {
			const waiting = yield* askWorker(fixture.provider, id);
			yield* answerWorker(fixture.host.boardDir, waiting.decision, "response.defer", "not_now");
			return waiting.published;
		}
		finishWorkers(fixture.provider);
		const decision = (yield* (yield* Fleet).reconcile(id)).value.decision;
		if (decision?.published === undefined) {
			return yield* Effect.die("Missing guided decision");
		}
		return decision.published;
	}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts)));
}
