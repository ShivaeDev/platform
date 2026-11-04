import { Effect, Exit, Scope } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { Backend } from "@shivaedev/agent/backend.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { piState } from "#test/piState.ts";
import { piVerbs } from "#test/piVerbs.ts";

export const piAgent = storyKit({
	create: piState,
	name: "Pi embedded adapter",
	outboundPassthrough: true,
	stages: ["peer"],
	verbs: (state, story) => ({
		...piVerbs(state, story.tell),
		close: () => Scope.close(state.scope, Exit.void),
		closeResult: () => Scope.close(state.scope, Exit.void).pipe(Effect.matchCause({ onFailure: () => "close failed", onSuccess: () => "closed" })),
		connect: () =>
			state.connect().pipe(
				Effect.tap((value) =>
					Effect.sync(() => {
						state.connection.value = value;
					}),
				),
			),
		models: () => state.connection.value.agent.models.list,
		negotiate: (feature: "imageInput" | "transcript") =>
			requireFeatures([feature]).pipe(
				Effect.provideService(Backend, state.connection.value.backend),
				Effect.as("supported"),
				Effect.catchTag("UnsupportedCapability", (error) => Effect.succeed(error.available.features[feature])),
			),
		reconcile: (operationId: string) => state.connection.value.agent.reconcile(operationId),
		requests: () =>
			Effect.sync(() =>
				state.peer.sessions.map((session) => ({
					history: session.history,
					model: session.options.model?.id,
					prompts: session.prompts,
					thinkingLevel: session.options.thinkingLevel,
					tools: session.options.tools,
				})),
			),
		resources: () => Effect.sync(() => state.peer.resources),
	}),
});

export const refused = piAgent.trait("peer", "Pi refuses preflight", ({ peer }) => {
	peer.refusal = "preflight";
});
export const unknownAcceptance = piAgent.trait("peer", "Pi fails without preflight evidence", ({ peer }) => {
	peer.refusal = "unknown";
});
export const noCredentials = piAgent.trait("peer", "Pi has no credentialed models", ({ peer }) => {
	peer.models = [];
});
export const constrained = piAgent.trait("peer", "the application supplies a constrained prompt", ({ options }) => {
	options.value = { constrainedPrompt: "Only this job." };
});

export const abortFailure = piAgent.trait("peer", "Pi's abort fails", ({ peer }) => {
	peer.abortFails = true;
});
