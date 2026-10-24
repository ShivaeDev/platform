import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { markdownBoard } from "#board/markdown.ts";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { reportBoard } from "#test/report.ts";

export function queuedReportWork() {
	return engineConfiguration("report work starts while the provider queue is full", (state) =>
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
		}),
	);
}
