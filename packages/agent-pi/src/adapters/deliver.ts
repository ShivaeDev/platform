import type { AgentSession, PromptOptions } from "@earendil-works/pi-coding-agent";
import { Effect } from "effect";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import { protocolFailure, rejected } from "#adapters/failure.ts";

type PromptDisposition = Parameters<NonNullable<PromptOptions["preflightResult"]>>[0];

export function deliver(session: AgentSession, text: string, delivery: "followUp" | "steer"): Effect.Effect<PromptDisposition, BackendFailure> {
	return Effect.callback<PromptDisposition, BackendFailure>((resume) => {
		let accepted = false;
		session
			.prompt(text, {
				preflightResult: (disposition) => {
					accepted = true;
					resume(Effect.succeed(disposition));
				},
				streamingBehavior: delivery,
			})
			.then(
				() => {
					if (!accepted) {
						resume(Effect.fail(protocolFailure("Pi prompt resolved without acceptance evidence")));
					}
				},
				(error: unknown) => {
					if (!accepted) {
						resume(Effect.fail(rejected(error)));
					}
				},
			);
	});
}
