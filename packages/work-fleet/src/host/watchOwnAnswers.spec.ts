import { expect } from "@effect/vitest";
import { fakeCodex } from "#test/hostScenarioTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";

host.it(
	"board-answer watch skips Fleet release and answer responses and reports another person's answer",
	[approvedWork(["one"]), fakeCodex],
	function* (daemon) {
		yield* daemon.watchEvents({ events: "board-answer", heartbeat: 0.1 });
		yield* daemon.awaitEvent("heartbeat");
		let worker = yield* daemon.dispatch("one");
		daemon.completeCodexTurn(worker, "FLEET_QUESTION: Which implementation should I use?");
		yield* daemon.reconcile("one");
		expect((yield* daemon.cli(["release", "one"])).code).toBe(0);
		yield* daemon.appliedAnswer("one");
		yield* daemon.stop();
		yield* daemon.start();
		worker = yield* daemon.dispatch("one");
		daemon.completeCodexTurn(worker, "FLEET_QUESTION: Which scope should ship?");
		yield* daemon.reconcile("one");
		expect((yield* daemon.cli(["answer", "one", "Ship the approved scope."])).code).toBe(0);
		yield* daemon.appliedAnswer("one");
		const published = yield* daemon.publishBoardDecision("one", {
			attentionOwner: "maintainer",
			id: "confirm-scope",
			links: [],
			reason: "Confirm the scope.",
			recommendation: "Ship it.",
		});
		const board = yield* daemon.boardHttp();
		yield* daemon.publishAnswer(board, {
			answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
			author: "Morgan",
			body: "Scope confirmed.",
			id: "response.confirmed",
			question: published.questionId,
			type: "answer",
		});
		yield* daemon.awaitOutput("events", '"responseId":"response.confirmed"');
		expect(daemon.responseFiles().sort()).toEqual([
			"response.confirmed.md",
			expect.stringMatching(/^response\.fleet-release\./u),
			expect.stringMatching(/^response\.fleet-retry\./u),
		]);
		expect(daemon.eventLines().filter((line) => typeof line === "object" && line !== null && "kind" in line && line.kind === "board-answer")).toEqual(
			[expect.objectContaining({ author: "Morgan", responseId: "response.confirmed", workId: "one" })],
		);
	},
);
