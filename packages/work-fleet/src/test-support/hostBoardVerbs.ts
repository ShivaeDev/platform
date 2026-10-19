import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { recordDecisionResponse } from "#host/recordDecisionResponse.ts";
import { withDecisionResponses } from "#host/releaseWork.ts";
import type { Decision } from "#policy.ts";
import { boardHttp, boardHttpFiles } from "#test/boardHttp.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { questionPublicationVerbs } from "#test/questionPublicationVerbs.ts";

export function hostBoardVerbs(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		...questionPublicationVerbs(engine, tell),
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
		readBoard: (file: string) => readFileSync(join(engine.fixture.host.boardDir, file), "utf8"),
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
		responseFiles: () => readdirSync(join(engine.fixture.host.boardDir, "responses")).filter((file) => file.startsWith("response.")),
		writeBoard: (file: string, source: string) => {
			tell(`write Board source ${file}`);
			engine.fixture.write(file, source);
		},
	};
}
