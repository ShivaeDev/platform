import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { responseMarkdown } from "@shivaedev/work-board/server/responses/records.ts";
import type { BoardDecision } from "#board/schema.ts";
import { pendingAcknowledgements } from "#engine/pendingAcknowledgements.ts";
import { daemonClient } from "#host/daemonClient.ts";
import { BoardFailure, BoardGateway } from "#policy.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { answerAndWait, dispatchAndWait } from "#test/daemonActions.ts";
import { finishWorkers } from "#test/engine.ts";
import { engineIntegrations } from "#test/engineIntegrations.ts";
import { cliProcess } from "#test/fleetCli.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { withFollower } from "#test/follower.ts";
import { postgresTests } from "#test/postgres.ts";
import { mainObservation } from "#test/preparation.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const test = postgresTests("live");

for (const release of [false, true]) {
	test(`a stale question acknowledgement clears when work is ${release ? "released" : "completed"}, including CLI status and watch`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => {
			const originalBoard = fixture.parts.board;
			if (originalBoard === undefined) {
				throw new Error("Missing fixture Board");
			}
			let unavailable = true;
			let attempts = 0;
			const board = Layer.effect(BoardGateway)(
				Effect.map(BoardGateway, (original) => ({
					...original,
					acknowledgeDecision: (input) => {
						attempts += 1;
						return unavailable ? Effect.fail(new BoardFailure({ message: "Board temporarily unavailable" })) : original.acknowledgeDecision(input);
					},
				})),
			).pipe(Layer.provideMerge(originalBoard));
			const parts = {
				...fixture.parts,
				board,
				integrations: engineIntegrations(
					{
						mainQuery: (preparation) =>
							Effect.succeed(mainObservation({ fromRevision: preparation.baseRevision, revision: preparation.baseRevision })),
						noChange: true,
					},
					[],
				),
			};
			return withReadDaemon(
				fixture.host,
				(port) =>
					staleStory(
						fixture,
						port,
						release,
						() => {
							unavailable = false;
						},
						() => attempts,
					),
				{ parts },
			);
		}));
}

const watchCompleted = Effect.fn("StaleAcknowledgementTest.watchCompleted")(function* (configFile: string, port: number, release: boolean) {
	yield* withFollower(configFile, "watch", ["one"], { port }, (follower) =>
		Effect.gen(function* () {
			const watched = yield* Effect.promise(() => follower.done);
			expect(watched.code).toBe(0);
			expect(watched.stdout).toBe(release ? "one released" : "one done: Existing behavior meets acceptance criteria");
		}),
	);
});

const staleStory = Effect.fn("StaleAcknowledgementTest.staleStory")(function* (
	fixture: HostFixture,
	port: number,
	release: boolean,
	available: () => void,
	attempts: () => number,
) {
	const client = yield* daemonClient(port);
	const started = yield* dispatchAndWait(client, "one");
	expect(started.step).toBe("working");
	const turn = started.attempts.at(-1)?.receipt?.turnId ?? "missing";
	const observation = fixture.provider.observations.get(turn) ?? (yield* Effect.die("Missing worker"));
	fixture.provider.observations.set(turn, { ...observation, execution: "completed", output: "FLEET_QUESTION: Which storage?" });
	const waiting = yield* client("fleet.reconcile", { workId: "one" });
	const published = waiting.decision?.published ?? (yield* Effect.die("Missing published question"));
	const answered = yield* answerAndWait(client, { release, text: "Use PostgreSQL.", workId: "one" });
	expect(answered.blocker).toContain("Board request acknowledgement pending");
	expect(pendingAcknowledgements(answered)).toHaveLength(1);
	const response = answered.responses?.[0] ?? (yield* Effect.die("Missing recorded answer"));
	const files = boardHttpFiles(fixture.host.boardDir);
	const responseFile = `responses/${response.responseId}.md`;
	const history = files.read(responseFile);
	supersede(fixture.host.boardDir, published, response.responseId, release);
	available();
	finishWorkers(fixture.provider);
	const completed = yield* client("fleet.reconcile", { workId: "one" });
	expect(completed.step).toBe(release ? "released" : "done");
	expect(completed.blocker).toBeUndefined();
	expect(completed.responses).toEqual([
		{ ...response, ...(release ? { boardAcknowledged: true } : {}), boardAcknowledgementDisposition: "superseded" },
	]);
	expect(pendingAcknowledgements(completed)).toEqual([]);
	expect(files.read(responseFile)).toBe(history);
	expect(files.receipts()).toHaveLength(release ? 1 : 0);
	if (release) {
		expect(files.read(files.receipts()[0] ?? "missing")).toContain('"disposition":"superseded"');
	}
	const previousAttempts = attempts();
	yield* client("fleet.reconcile", { workId: "one" });
	expect(attempts()).toBe(previousAttempts);
	const status = yield* Effect.promise(() => cliProcess(["status", "--port", String(port)]));
	expect(status.code).toBe(0);
	expect(status.stdout).toContain("Waiting on orchestrator (0)");
	expect(status.stdout).not.toContain("acknowledgement pending");
	if (!release) {
		expect(status.stdout).toContain("Done (1)\n  one  done");
	}
	yield* watchCompleted(fixture.configFile, port, release);
});

function supersede(root: string, published: BoardDecision, responseId: string, release: boolean) {
	const files = boardHttpFiles(root);
	if (release) {
		files.write(
			"responses/replacement.md",
			responseMarkdown({
				body: "A later turn replaces this answer.",
				id: "response.replacement",
				response: {
					author: "orchestrator",
					question: published.questionId,
					recordedAt: 2000,
					reviewedRevision: published.revision,
					supersedes: responseId,
					type: "answer",
				},
			}),
		);
	} else {
		files.write(published.sourcePath, "# Decision replaced by a later turn\n");
	}
}
