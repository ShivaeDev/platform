import { Effect } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { SessionFailure } from "#session/schema.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { workPublication } from "#test/workPublication.ts";

export function lostThreadAcknowledgement(losses = 1, unavailableRestarts = 0) {
	return engineConfiguration("Codex loses thread acknowledgements before starting any turn", (state) => {
		const publication = workPublication();
		state.publication = publication;
		const native = codexAdapter(() => Effect.die("A lost thread has no provider lookup"), {
			beforeTurn: () => Effect.succeed({}),
			provisioning: "unknown",
			threadStart: () => ({}),
		});
		let remaining = losses;
		let unavailable = unavailableRestarts;
		function acknowledge(sessionId: string) {
			remaining -= 1;
			if (remaining >= 0) {
				return Effect.fail(
					new SessionFailure({ code: "session-unavailable", message: "Codex disconnected before thread acknowledgement", reason: "ambiguous" }),
				);
			}
			unavailable -= 1;
			return unavailable >= 0
				? Effect.fail(new SessionFailure({ message: "Codex is still unavailable", reason: "unavailable" }))
				: Effect.succeed(sessionId);
		}
		return {
			decorateTransport: (transport) => ({
				...transport,
				reconcile: (input) => (input.sessionId === undefined ? native.reconcile(input) : transport.reconcile(input)),
				startSession: (input) => transport.startSession(input).pipe(Effect.flatMap(acknowledge)),
			}),
			publicationQuery: publication.query,
		};
	});
}
