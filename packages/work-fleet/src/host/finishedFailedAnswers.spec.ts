import { Effect, Option, Stream } from "effect";
import { expect } from "vitest";
import { board } from "@shivaedev/work-board/server/integration/board.ts";
import { failedAnswer } from "#test/failedAnswer.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host, storedWork } from "#test/hostStory.ts";

for (const [step, status] of [
	["done", "done"],
	["released", "ready"],
	["waiting", "deferred"],
	["waiting", "dropped"],
] as const) {
	host.it(
		`the close command settles a failed answer for ${step} work with Board status ${status}`,
		[boardWork({ "one.md": task("one").replace("kind: task", `kind: task\nstatus: ${status}`) }), storedWork("one", step), failedAnswer("one")],
		function* (fleet) {
			const published = yield* fleet.publishBoardDecision("one", {
				id: "one.1",
				links: [],
				reason: "Choose storage",
				recommendation: "Use PostgreSQL",
			});
			const http = yield* fleet.boardHttp();
			yield* fleet.publishAnswer(http, {
				answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
				author: "orchestrator",
				body: "Use PostgreSQL.",
				id: "response.one",
				question: published.questionId,
				type: "answer",
			});
			expect((yield* fleet.status()).waiting.orchestrator).toMatchObject(
				step === "waiting" ? [{ blocker: expect.stringContaining("Answer failed:"), workId: "one" }] : [],
			);
			const reason = `Closed because ${step === "waiting" ? "Board" : "Fleet"} work one is ${step === "waiting" ? status : step}.`;
			const preview = yield* fleet.cli(["close-finished-decisions", "--dry-run"]);
			expect(preview).toMatchObject({ code: 0, stdout: expect.stringContaining("1 decision(s) would close.") });
			expect(preview.stdout).toContain(reason);
			expect(board.metadataParse(fleet.readBoard(published.sourcePath)).fields.attention).toMatchObject([{ state: "open" }]);
			expect((yield* fleet.status()).waiting.orchestrator).toMatchObject(step === "waiting" ? [{ workId: "one" }] : []);
			expect(yield* fleet.cli(["close-finished-decisions"])).toMatchObject({ code: 0, stdout: expect.stringContaining("1 decision(s) closed.") });
			expect(board.metadataParse(fleet.readBoard(published.sourcePath)).fields).toMatchObject({
				attention: [{ state: "closed" }],
				nextAction: reason,
				status: "done",
			});
			expect((yield* fleet.status()).waiting.orchestrator).toEqual([]);
			expect((yield* fleet.cli(["status"])).stdout).not.toContain("Answer failed:");
			const snapshot = yield* fleet.request("daemon.watch", { workIds: ["one"] }).pipe(
				Stream.filter((value) => value.states !== undefined),
				Stream.runHead,
				Effect.timeout("5 seconds"),
			);
			const states = Option.getOrThrow(snapshot).states;
			expect(states).toMatchObject([{ stage: step === "done" ? "done" : "released", workId: "one" }]);
			expect(states?.[0]?.answerFailure).toBeUndefined();
			expect(states?.[0]?.blocker).toBeUndefined();
			expect(yield* fleet.cli(["close-finished-decisions"])).toMatchObject({ code: 0, stdout: "0 decision(s) closed." });
		},
	);
}

host.it(
	"the close command leaves an active failed answer in the orchestrator list and watch",
	[
		boardWork({ "finished.md": task("finished"), "one.md": task("one") }),
		storedWork("one", "working"),
		storedWork("finished", "done"),
		failedAnswer("one"),
		failedAnswer("finished"),
	],
	function* (fleet) {
		const closed = yield* fleet.cli(["close-finished-decisions"]);
		expect(closed).toMatchObject({ code: 0, stdout: expect.stringContaining("1 decision(s) closed.") });
		expect(closed.stdout).toContain("Closed because Fleet work finished is done.");
		expect(fleet.logs()).toContainEqual(
			expect.objectContaining({
				message: expect.arrayContaining(["Closed failed answer for finished: Closed because Fleet work finished is done."]),
			}),
		);
		expect((yield* fleet.status()).waiting.orchestrator).toMatchObject([{ blocker: expect.stringContaining("Answer failed:"), workId: "one" }]);
		const snapshot = yield* fleet.request("daemon.watch", { workIds: ["one"] }).pipe(
			Stream.filter((value) => value.states !== undefined),
			Stream.runHead,
			Effect.timeout("5 seconds"),
		);
		expect(snapshot).toMatchObject({
			value: { states: [{ answerFailure: { error: expect.any(String) }, attentionOwner: "orchestrator", workId: "one" }] },
		});
	},
);
