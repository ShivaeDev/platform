import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { Effect } from "effect";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import { protocolFailure, rejected } from "#adapters/failure.ts";

export function deliver(session: AgentSession, text: string, delivery: "followUp" | "steer") {
	return Effect.callback<void, BackendFailure>((resume) => {
		let preflight: boolean | undefined;
		session
			.prompt(text, {
				preflightResult: (ok) => {
					preflight = ok;
					if (ok) {
						resume(Effect.void);
					}
				},
				streamingBehavior: delivery,
			})
			.then(
				() => resume(Effect.void),
				(error: unknown) => resume(Effect.fail(preflight === false ? rejected(error) : protocolFailure(error))),
			);
	});
}
