import { Effect, Exit, Fiber, Queue, Scope } from "effect";
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
		accept: (name: string) =>
			Effect.sync(() => {
				const session = state.heldSessions.get(name);
				if (session === undefined) {
					throw new Error(`no pending Pi session for ${name}`);
				}
				session.accept();
			}),
		begin: (name: string, text: string) =>
			Effect.gen(function* () {
				const fiber = yield* state.connection.value.agent
					.start({ cwd: state.directory, input: { parts: [{ text, type: "text" }] }, operationId: name })
					.pipe(Effect.provideService(Scope.Scope, state.scope), Effect.forkScoped({ startImmediately: true }));
				state.pendingStarts.set(name, fiber);
				yield* Queue.take(state.peer.prompted);
				const opened = state.peer.sessions.at(-1);
				if (opened === undefined) {
					return yield* Effect.die("no pending Pi session");
				}
				state.heldSessions.set(name, opened);
			}),
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
		join: (name: string) =>
			Effect.suspend(() => {
				const fiber = state.pendingStarts.get(name);
				return fiber === undefined ? Effect.die(`no pending submission for ${name}`) : Fiber.join(fiber);
			}),
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

export const heldPreflight = piAgent.trait("peer", "Pi holds preflight acceptance", ({ peer }) => {
	peer.held = true;
});
export const noSessionFile = piAgent.trait("peer", "Pi returns no persistent session file", ({ peer }) => {
	peer.noSessionFile = true;
});
