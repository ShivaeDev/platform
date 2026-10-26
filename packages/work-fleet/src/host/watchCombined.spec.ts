import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { HEAD } from "#test/githubResult.ts";
import { approvedWork, boardWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

host.it(
	"one watch carries Fleet readiness, dequeue reasons, conflicts, stuck queues and closed PRs",
	[approvedWork(["one"]), humanDelivery],
	function* (daemon) {
		const github = yield* daemon.prApi();
		github.pull({ "auto_merge": null });
		yield* daemon.watchEvents({ apiUrl: github.url, prEvents: true, prInterval: 0.1 });
		yield* daemon.awaitSnapshot();
		const worker = yield* daemon.dispatch("one");
		daemon.finishReviewedWorker(worker);
		yield* daemon.reviewReady("one");
		yield* daemon.awaitEvent("waiting-on-orchestrator");
		yield* github.awaitPoll();
		github.pull({ mergeable: false, "mergeable_state": "dirty" });
		yield* daemon.awaitEvent("pr-conflict");
		yield* daemon.awaitEvent("pr-stuck");
		github.pull({ "auto_merge": null });
		github.queue(false, "CONFLICT");
		yield* daemon.awaitEvent("pr-dequeued");
		yield* daemon.awaitEvent("pr-auto-merge-off");
		github.pull({ state: "closed" });
		yield* daemon.awaitEvent("pr-closed");
		const lines = daemon.eventLines();
		expect(lines).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ head: HEAD, kind: "waiting-on-orchestrator", workId: "one" }),
				expect.objectContaining({
					kind: "pr-dequeued",
					number: 7,
					pr: github.pr,
					reason: "CONFLICT",
					repository: "example/repository",
					workId: "one",
				}),
				expect.objectContaining({ kind: "pr-conflict", pr: github.pr }),
				expect.objectContaining({ kind: "pr-stuck", pr: github.pr }),
				expect.objectContaining({ kind: "pr-auto-merge-off", pr: github.pr }),
				expect.objectContaining({ kind: "pr-closed", pr: github.pr }),
			]),
		);
		expect(lines).not.toContainEqual(expect.objectContaining({ kind: "heartbeat" }));
		expect(daemon.watchRunning()).toBe(true);
	},
);

host.it(
	"a transient GitHub failure keeps the combined watch running until a later PR event",
	[approvedWork(["one"]), humanDelivery],
	function* (daemon) {
		const github = yield* daemon.prApi();
		yield* daemon.watchEvents({ apiUrl: github.url, prEvents: true, prInterval: 0.1 });
		yield* daemon.awaitSnapshot();
		const worker = yield* daemon.dispatch("one");
		daemon.finishReviewedWorker(worker);
		yield* daemon.reviewReady("one");
		yield* daemon.awaitEvent("waiting-on-orchestrator");
		yield* github.awaitPoll();
		github.fail(503);
		yield* daemon.awaitEvent("pr-error");
		expect(daemon.watchRunning()).toBe(true);
		github.pull({ state: "closed" });
		yield* daemon.awaitEvent("pr-closed");
		expect(daemon.eventLines()).not.toContainEqual(expect.objectContaining({ kind: "pr-stopped" }));
		expect(daemon.eventLines()).not.toContainEqual(expect.objectContaining({ kind: "heartbeat" }));
	},
);

host.it(
	"a repository-wide authentication failure is an event before the combined stream ends",
	[approvedWork(["one"]), humanDelivery],
	function* (daemon) {
		const github = yield* daemon.prApi();
		github.failRepository(401);
		yield* daemon.watchEvents({ apiUrl: github.url, prEvents: true, prInterval: 0.1 });
		yield* daemon.awaitSnapshot();
		const worker = yield* daemon.dispatch("one");
		daemon.finishReviewedWorker(worker);
		yield* daemon.reviewReady("one");
		const result = yield* daemon.awaitWatchExit();
		expect(result.code).toBe(1);
		expect(daemon.eventLines()).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: "pr-error", message: expect.stringMatching(/\S/u) }),
				expect.objectContaining({ kind: "pr-stopped", reason: "failed" }),
			]),
		);
	},
);

host.it("an answer recorded through Board appears once even without running Fleet work", [boardWork({ "one.md": task("one") })], function* (daemon) {
	const published = yield* daemon.publishBoardDecision("one", {
		attentionOwner: "maintainer",
		id: "choose-scope",
		links: [],
		reason: "Which scope should ship?",
		recommendation: "Choose the approved scope.",
	});
	const board = yield* daemon.boardHttp();
	yield* daemon.watchEvents();
	yield* daemon.awaitSnapshot();
	yield* daemon.publishAnswer(board, {
		answers: [{ prompt: "fleet-action", selected: ["retry"], text: "" }],
		author: "Morgan",
		body: "Ship the approved scope.",
		id: "response.scope",
		question: published.questionId,
		type: "answer",
	});
	yield* daemon.awaitEvent("board-answer");
	yield* daemon.stop();
	yield* daemon.awaitEvent("daemon-unreachable");
	yield* daemon.start();
	yield* daemon.awaitEvent("daemon-back");
	yield* daemon.publishAnswer(board, {
		author: "Morgan",
		body: "The scope is confirmed.",
		id: "response.confirmed",
		question: published.questionId,
		type: "clarify",
	});
	yield* daemon.awaitOutput("events", '"responseId":"response.confirmed"');
	expect(daemon.eventLines().filter((line) => typeof line === "object" && line !== null && "kind" in line && line.kind === "board-answer")).toEqual([
		expect.objectContaining({
			author: "Morgan",
			kind: "board-answer",
			question: published.questionId,
			reason: expect.stringContaining("Which scope should ship?"),
			responseId: "response.scope",
			unblocks: ["one"],
			workId: "one",
		}),
		expect.objectContaining({ responseId: "response.confirmed" }),
	]);
	expect((yield* daemon.status()).active).toEqual([]);
});

host.it("quiet heartbeats are opt-in", [], function* (daemon) {
	yield* daemon.watchEvents({ heartbeat: 0.1 });
	yield* daemon.awaitEvent("heartbeat");
	expect(daemon.eventLines()).toContainEqual({ kind: "heartbeat" });
});
