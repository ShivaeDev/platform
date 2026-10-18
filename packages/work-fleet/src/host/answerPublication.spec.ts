import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { responses as responsesApi } from "@shivaedev/work-board/server/integration/responses.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { answerAndWait, dispatchAndWait } from "#test/daemonActions.ts";
import { finishWorkers } from "#test/engine.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { storeState } from "#test/storeState.ts";

const test = postgresTests("live");

for (const action of ["retry", "release"] as const) {
	test(`answer ${action} re-registers a republished decision with a changed template`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) =>
			withReadDaemon(fixture.host, (port) => republishedStory(fixture, port, action), { parts: fixture.parts }),
		));
}

const republishedStory = Effect.fn("DaemonCommandsTest.republishedStory")(function* (
	fixture: HostFixture,
	port: number,
	action: "retry" | "release",
) {
	const client = yield* daemonClient(port);
	yield* dispatchAndWait(client, "one");
	finishWorkers(fixture.provider);
	const waiting = yield* client("fleet.reconcile", { workId: "one" });
	const decision = waiting.decision;
	const published = decision?.published;
	if (decision === undefined || published === undefined) {
		return yield* Effect.die("Expected a published decision");
	}
	const files = boardHttpFiles(fixture.host.boardDir);
	const context = files.read(published.sourcePath).replace("## Recommendation", "## Previous recommendation template");
	const revision = responsesApi.revisionOf(context);
	const questionId = responsesApi.questionId(published.itemId, published.request, revision, published.sourcePath);
	const previous = { ...published, questionId, revision };
	files.write(published.sourcePath, context);
	files.write(
		`responses/${questionId}.md`,
		responsesApi.questionMarkdown({
			context,
			id: questionId,
			question: {
				deadline: 1000,
				item: published.itemId,
				reason: decision.reason,
				registeredAt: 1,
				request: published.request,
				reviewedRevision: revision,
				source: published.sourcePath,
			},
		}),
	);
	yield* storeState(fixture.host, "one", { ...waiting, decision: { ...decision, published: previous } });
	files.write(
		published.sourcePath,
		files.read(published.sourcePath).replace("## Previous recommendation template", "## Current recommendation template"),
	);
	const answered = yield* answerAndWait(client, { release: action === "release", text: "", workId: "one" });
	expect(answered.stage).toBe(action === "release" ? "released" : "adopting");
	expect(answered.responses?.at(-1)).toMatchObject({
		action,
		boardAcknowledged: true,
		questionId: responsesApi.questionId(
			published.itemId,
			published.request,
			responsesApi.revisionOf(files.read(published.sourcePath)),
			published.sourcePath,
		),
	});
	expect(files.receipts()).toHaveLength(1);
});
