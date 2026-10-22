import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { task } from "#test/fleetHost.ts";
import { REPORT } from "#test/githubResult.ts";
import { boardWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";
import { pullRequestWithPendingChecks } from "#test/pullRequestWithPendingChecks.ts";

host.it(
	"disabling review before delivery goes straight to checks and human merge readiness",
	[boardWork({ "one.md": task("one", "approved") }), humanDelivery, pullRequestWithPendingChecks()],
	function* ({
		reconcile,
		dispatch,
		editConfig,
		waitForConfig,
		finishTurn,
		waitForRecord,
		providerStarts,
		setChecksPending,
		stop,
		start,
		mergePullRequest,
	}) {
		const worker = yield* dispatch("one");
		yield* editConfig({ review: false });
		const config = yield* waitForConfig((current) => current.settings.review === false);
		expect(config.restartRequired).toEqual([]);
		finishTurn(worker, REPORT);
		expect(yield* reconcile("one")).toMatchObject({ step: "validating" });
		const validating = yield* waitForRecord("one", (record) => record.step === "validating" && record.checks?.pending === true);
		expect(validating.review).toBeUndefined();
		expect(providerStarts()).toEqual([expect.objectContaining({ operationId: worker.attempts[0]?.operationId })]);
		yield* editConfig({ review: true });
		yield* waitForConfig((current) => current.settings.review === true);
		yield* stop();
		yield* start();
		setChecksPending(false);
		yield* reconcile("one");
		const ready = yield* waitForRecord("one", (record) => record.decision?.code === "reviewed-pr-ready");
		expect(ready.step).toBe("waiting");
		expect(ready.decision?.reason).toBe("Validated PR is ready to merge");
		expect(ready.decision?.recommendation).toContain("Merge the green PR");
		expect(ready.checks?.passed).toBe(true);
		expect(ready.review).toBeUndefined();
		expect(providerStarts()).toEqual([expect.objectContaining({ operationId: worker.attempts[0]?.operationId })]);
		mergePullRequest();
		yield* reconcile("one");
		expect((yield* waitForRecord("one", (record) => record.step === "done")).outcome).toMatchObject({ head: ready.result?.head });
	},
);

for (const review of [true, undefined]) {
	host.it(
		`enabling review with ${review === undefined ? "the default" : "true"} launches an independent reviewer`,
		[
			boardWork({ "one.md": task("one", "approved"), "two.md": task("two", "approved") }, { concurrency: 1, review: false }),
			humanDelivery,
			pullRequestWithPendingChecks(),
		],
		function* ({ reconcile, dispatch, editConfig, waitForConfig, finishTurn, waitForRecord, providerStarts }) {
			const first = yield* dispatch("one");
			finishTurn(first, REPORT);
			yield* reconcile("one");
			yield* waitForRecord("one", (record) => record.step === "validating");
			expect(providerStarts()).toEqual([expect.objectContaining({ operationId: first.attempts[0]?.operationId })]);
			yield* editConfig({ review });
			yield* waitForConfig((current) => current.settings.review === true);
			const second = yield* dispatch("two");
			finishTurn(second, REPORT);
			yield* reconcile("two");
			const validated = yield* waitForRecord("two", (record) => record.step === "validating");
			expect(validated.review).toMatchObject({ head: validated.result?.head, verdict: "approved" });
			expect(providerStarts()).toContainEqual(expect.objectContaining({ access: "read-only" }));
		},
	);
}

host.it(
	"hot-reloads advisory review without a daemon restart",
	[boardWork({ "one.md": task("one", "approved") }, { review: false }), humanDelivery],
	function* ({ dispatch, editConfig, waitForConfig, finishTurn, reconcile, waitForRecord, readBoard, boardHttp, cli }) {
		const worker = yield* dispatch("one");
		yield* editConfig({ review: "advisory" });
		const config = yield* waitForConfig((current) => current.settings.review === "advisory");
		expect(config.restartRequired).toEqual([]);
		finishTurn(worker, REPORT);
		yield* reconcile("one");
		const ready = yield* waitForRecord("one", (record) => record.decision?.code === "reviewed-pr-ready");
		expect(ready.reviewAdvisoryHead).toBe(ready.result?.head);
		expect(ready.review?.document).toBeDefined();
		expect(readBoard(ready.review?.document?.publication.sourcePath ?? "missing")).toContain("## TL;DR");
		yield* cli(["reassign", "one", ready.decision?.id ?? "missing", "maintainer"]);
		const board = yield* boardHttp();
		const list = yield* Effect.tryPromise(() => board.client.run(board.client.api.fleetItems.run(undefined)));
		expect(list).toMatchObject({
			items: [
				expect.objectContaining({
					readyToMerge: true,
					review: { sourcePath: ready.review?.document?.publication.sourcePath, tldr: ready.review?.document?.tldr },
				}),
			],
			state: "ready",
		});
	},
);
