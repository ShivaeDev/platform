import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import { responseMarkdown } from "@shivaedev/work-board/responses/records.ts";
import { markdownBoard } from "#board/markdown.ts";
import type { BoardDecision } from "#board/schema.ts";
import { BoardFailure, BoardGateway } from "#policy.ts";

export const reportBoard = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const root = yield* fs.makeTempDirectoryScoped();
	yield* fs.writeFileString(path.join(root, "one.md"), "---\nid: one\nkind: task\nfleet: approved\nfleet-deliverable: report\n---\n# Research\n");
	return root;
});

export function lostReportReceipt(root: string) {
	let publications = 0;
	const board = Layer.effect(BoardGateway)(
		Effect.gen(function* () {
			const original = yield* BoardGateway;
			return BoardGateway.of({
				...original,
				report: (work, observation) =>
					original.report(work, observation).pipe(
						Effect.flatMap((receipt) => {
							publications += 1;
							return publications === 1 ? Effect.fail(new BoardFailure({ message: "Lost report publication receipt" })) : Effect.succeed(receipt);
						}),
					),
			});
		}),
	).pipe(Layer.provide(markdownBoard(root).pipe(Layer.provide(NodeServices.layer))));
	return { board, count: () => publications };
}

export function answerReport(root: string, decision: BoardDecision, action: "retry" | "release") {
	const response = responseMarkdown({
		body: "Resolve the report decision.",
		id: `synthetic.${action}`,
		response: {
			answers: [{ prompt: "fleet-action", selected: [action], text: "" }],
			author: "Maintainer",
			question: decision.questionId,
			recordedAt: 100,
			reviewedRevision: decision.revision,
			type: "answer",
		},
	});
	writeFileSync(join(root, "responses", `synthetic.${action}.md`), response);
	return `synthetic.${action}`;
}
