import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { SessionFailure } from "#session/schema.ts";
import type { EngineStory } from "#test/engineState.ts";
import { reportBoard } from "#test/report.ts";

export function queuedReportWork() {
	return (state: EngineStory) =>
		Effect.gen(function* () {
			const root = yield* reportBoard;
			state.root = root;
			state.board = markdownBoard(root).pipe(Layer.provide(NodeServices.layer));
			state.providerRejects = true;
			return {
				submissionFailure: () =>
					state.providerRejects
						? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" })
						: undefined,
				workerGuidance: "Follow synthetic report conventions.",
			};
		});
}
