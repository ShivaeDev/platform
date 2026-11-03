import { Effect } from "effect";
import { rejected, unavailable } from "./piFailure.ts";
import type { PiSession } from "./piRuntime.ts";

// Pi's prompt promise ends with the run; the preflight callback acknowledges its input.
function acceptedBy(session: PiSession, text: string, delivery: "followUp" | "steer") {
	return new Promise<void>((accept, refuse) => {
		function preflightResult(ok: boolean) {
			if (ok) {
				accept();
			}
		}
		session.prompt(text, { preflightResult, streamingBehavior: delivery }).then(accept, refuse);
	});
}
export function sendInput(session: PiSession, text: string, delivery: "followUp" | "steer") {
	return Effect.tryPromise({ catch: rejected, try: () => acceptedBy(session, text, delivery) });
}
export function abortSession(session: PiSession) {
	return Effect.tryPromise({ catch: unavailable, try: () => session.abort() });
}
export function disposeSession(session: PiSession) {
	return Effect.promise(() => session.abort()).pipe(Effect.ensuring(Effect.sync(() => session.dispose())));
}
