import { Clock, Effect } from "effect";
import { type Reading, ResponseFailed } from "#browser/responses/schema.ts";
import { outcome } from "./outcome.ts";

export function awaitResponse(read: (id: string) => Effect.Effect<Reading, ResponseFailed>) {
	return Effect.fn("WorkBoard.awaitResponse")(function* (input: { readonly question: string; readonly after?: string | undefined }) {
		const lease = (yield* Clock.currentTimeMillis) + 30_000;
		while (true) {
			const result = yield* read(input.question);
			const now = yield* Clock.currentTimeMillis;
			const state = outcome(result, input.after, now);
			if (state.kind === "missing_cursor") {
				return yield* Effect.fail(new ResponseFailed({ code: "Missing", message: "The next-response cursor is not recorded for this question." }));
			}
			if (state.kind !== "pending" || now >= lease) {
				return { expired: state.kind === "unanswered", question: result.question, response: state.kind === "response" ? state.response : undefined };
			}
			yield* Effect.sleep("1 second");
		}
	});
}
