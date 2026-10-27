import { request } from "node:http";
import { Effect } from "effect";

export const holdBoardRequest = Effect.fn("SupervisorStory.holdBoardRequest")(function* (socketPath: string) {
	const outgoing = yield* Effect.acquireRelease(
		Effect.sync(() =>
			request("http://localhost/_board/rpc", {
				headers: { "content-type": "application/ndjson", expect: "100-continue" },
				method: "POST",
				socketPath,
			}),
		),
		(connection) => Effect.sync(() => connection.destroy()),
	);
	yield* Effect.callback<void, Error>((resume) => {
		outgoing.once("continue", () => resume(Effect.void));
		outgoing.on("response", (response) => response.resume());
		outgoing.on("error", (error) => resume(Effect.fail(error)));
		outgoing.flushHeaders();
	}).pipe(Effect.timeout("5 seconds"));
});
