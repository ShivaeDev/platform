import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { markdownBoard } from "#board/markdown.ts";
import { reportIdentity } from "#board/reportIdentity.ts";
import { reportPayload } from "#board/reportPayload.ts";
import { reportPayloadFile } from "#board/reportPayloadFile.ts";
import { BoardGateway } from "#policy.ts";
import { reportBoard } from "#test/report.ts";

const OBSERVATION = { execution: "completed", output: "Evidence", provisioning: "ready", receipt: { sessionId: "worker", turnId: "turn" } } as const;
for (const [problem, content] of [
	["malformed JSON", "broken"],
	["invalid base64", JSON.stringify({ files: [{ base64: "*", path: "evidence.txt" }], output: "Evidence" })],
	["unsafe names", JSON.stringify({ files: [{ base64: "", path: "../outside" }], output: "Evidence" })],
	["duplicate names", JSON.stringify({ files: Array.from({ length: 2 }, () => ({ base64: "", path: "evidence.txt" })), output: "Evidence" })],
	["too many files", JSON.stringify({ files: Array.from({ length: 65 }, (_, index) => ({ base64: "", path: `${index}.txt` })), output: "Evidence" })],
] as const) {
	it.live(`refuses a persisted payload with ${problem}`, () =>
		Effect.gen(function* () {
			const root = yield* reportBoard;
			const work = yield* BoardGateway.pipe(
				Effect.flatMap((board) => board.get("one")),
				Effect.provide(markdownBoard(root)),
			);
			const { itemId } = reportIdentity(work, OBSERVATION.receipt);
			yield* reportPayloadFile(root, itemId, content);
			expect((yield* Effect.result(reportPayload(root, work, OBSERVATION).read))._tag).toBe("Failure");
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
