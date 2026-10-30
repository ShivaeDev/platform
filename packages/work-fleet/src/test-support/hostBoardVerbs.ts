import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import type { Decision } from "#policy.ts";
import { BoardGateway } from "#policy.ts";
import { boardHttp, boardHttpFiles } from "#test/boardHttp.ts";
import { until } from "#test/cloudRestart.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { questionPublicationVerbs } from "#test/questionPublicationVerbs.ts";
import { storedBoardPath, storedBoardResponses, storedBoardSource } from "#test/storedBoard.ts";

export function hostBoardVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		awaitBoardResponse: (ready: (source: string) => boolean) => {
			tell("wait for a closing Board response");
			function read() {
				return storedBoardResponses(engine.fixture.host.boardDir)
					.filter((file) => file.startsWith("response."))
					.map((file) => storedBoardSource(engine.fixture.host.boardDir, `responses/${file}`))
					.find(ready);
			}
			return until(() => Effect.sync(() => read() !== undefined)).pipe(Effect.map(read));
		},
		awaitBoardSource: (file: string, ready: (source: string) => boolean) => {
			tell(`wait for the generated Board source ${file}`);
			const path = storedBoardPath(engine.fixture.host.boardDir, file);
			return until(() => Effect.sync(() => existsSync(path) && ready(readFileSync(path, "utf8")))).pipe(Effect.map(() => readFileSync(path, "utf8")));
		},
		publishBoardDecision: (workId: string, decision: Decision) => {
			tell(`publish a Fleet decision for ${workId}`);
			return Effect.flatMap(BoardGateway, (board) => board.decision(workId, decision)).pipe(Effect.provideContext(engine.running.context));
		},
		...questionPublicationVerbs(engine, tell),
		boardAcknowledgements: () => boardHttpFiles(engine.fixture.host.boardDir).receiptRecords(),
		boardExists: (file: string) => existsSync(join(engine.fixture.host.boardDir, file)),
		boardHttp: () => {
			tell("open Board HTTP against the running Fleet daemon");
			return boardHttp(engine.fixture.host.boardDir, undefined, undefined, engine.running.port);
		},
		boardPath: (file: string) => join(engine.fixture.host.boardDir, file),
		inbox: (board: Effect.Success<ReturnType<typeof boardHttp>>) => Effect.tryPromise(() => board.client.run(board.client.api.inbox.run(undefined))),
		publishAnswer: (board: Effect.Success<ReturnType<typeof boardHttp>>, input: Parameters<typeof board.client.responses.recordResponse.run>[0]) => {
			tell(`publish Board answer ${input.id}`);
			return Effect.tryPromise(() => board.client.mutate(board.client.responses.recordResponse.run(input)));
		},
		question: (board: Effect.Success<ReturnType<typeof boardHttp>>, item: string, request: string) =>
			Effect.tryPromise(() => board.client.run(board.client.responses.question.run({ item, request }))),
		readBoard: (file: string) => storedBoardSource(engine.fixture.host.boardDir, file),
		receiptFiles: () => boardHttpFiles(engine.fixture.host.boardDir).receipts(),
		recordAnswer: (decision: Decision, action: "retry" | "release", text: string) => {
			if (decision.published === undefined) {
				throw new Error("The decision has no published question");
			}
			tell(`save an answer to ${decision.id} before Fleet applies it`);
			return withDecisionResponses(
				engine.fixture.host,
				recordDecisionResponse(engine.fixture.host.boardDir, { ...decision, published: decision.published }, action, text),
			).pipe(Effect.provideContext(engine.running.context));
		},
		respondRedirect: (board: Effect.Success<ReturnType<typeof boardHttp>>, item: string, request: string) =>
			Effect.tryPromise(() =>
				fetch(`${board.url}/_board/respond?item=${encodeURIComponent(item)}&request=${encodeURIComponent(request)}`, { redirect: "manual" }),
			),
		responseFiles: () => storedBoardResponses(engine.fixture.host.boardDir).filter((file) => file.startsWith("response.")),
		writeBoard: (file: string, source: string) => {
			tell(`write Board source ${file}`);
			engine.fixture.write(file, source);
		},
	};
}
