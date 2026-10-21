import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { board as boardApi } from "@shivaedev/work-board/server/integration/board.ts";
import { approvedWork, host } from "#test/hostStory.ts";

for (const action of ["retry", "release"] as const) {
	host.it(
		`answer ${action} answers the published decision by item through the daemon without a client database connection`,
		[approvedWork(["one"])],
		function* (daemon) {
			const started = yield* daemon.dispatch("one");
			daemon.finishTurn(started);
			const waiting = yield* daemon.reconcile("one");
			expect(waiting.step).toBe("waiting");
			const published = waiting.decision?.published;
			if (published === undefined) {
				throw new Error("Expected a published decision");
			}
			const args = ["answer", "one", ...(action === "release" ? ["--release"] : []), "--config", "unused.json"];
			expect(yield* daemon.cli(args)).toMatchObject({
				code: 0,
				stderr: "",
				stdout: "one waiting (waiting on automation): Answer recorded; applying in the background",
			});
			const current = yield* daemon.appliedAnswer("one");
			expect(current.decision).toBeUndefined();
			expect(current.responses).toMatchObject([
				{ action, boardAcknowledged: true, decisionId: waiting.decision?.id, questionId: published.questionId },
			]);
			expect(
				boardApi.metadataParse(daemon.readBoard(`responses/response.fleet-${action}.${published.questionId}.md`)).fields.response?.answers,
			).toEqual([{ prompt: "fleet-action", selected: [action], text: "" }]);
			expect(daemon.receiptFiles()).toHaveLength(1);
			expect((yield* daemon.cli(args)).code).toBe(1);
			expect(daemon.receiptFiles()).toHaveLength(1);
			expect(daemon.providerResources()).toEqual({ providers: 1, releases: 0 });
			expect(daemon.providerStarts()).toHaveLength(1);
			yield* daemon.stop();
			expect(daemon.providerResources()).toEqual({ providers: 1, releases: 1 });
		},
		30_000,
	);
}

host.it(
	"answer rejects an active item without recording a response",
	[approvedWork(["one"])],
	function* (daemon) {
		yield* daemon.dispatch("one");
		const result = yield* daemon.cli(["answer", "one", "--release"], { selection: "port" });
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("one waits on no answer in step working");
		expect(yield* daemon.answer("one").pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest", message: expect.stringContaining("working") });
		expect((yield* daemon.get("one")).step).toBe("working");
		expect(daemon.boardExists("responses")).toBe(false);
	},
	30_000,
);
