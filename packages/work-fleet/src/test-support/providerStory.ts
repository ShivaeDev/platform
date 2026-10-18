import { Clock, Context, Duration, Effect, Exit, Layer, Queue, Result, Scope } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration, codexServer, type WireRequest } from "#test/codex.ts";
import { authFolder, cloudConfiguration, FUTURE_EXPIRY, PAST_EXPIRY, refreshingCli, syntheticToken } from "#test/codexCloud.ts";
import { newProvider, type ProviderState } from "#test/providerStoryState.ts";
import { providerVerbs } from "#test/providerVerbs.ts";

const definition = {
	after: {
		*configuration(state: ProviderState) {
			const clock = yield* Clock.Clock;
			state.clock = {
				currentTimeMillis: clock.currentTimeMillis,
				currentTimeMillisUnsafe: () => clock.currentTimeMillisUnsafe(),
				currentTimeNanos: clock.currentTimeNanos,
				currentTimeNanosUnsafe: () => clock.currentTimeNanosUnsafe(),
				monotonicTimeNanos: clock.monotonicTimeNanos,
				monotonicTimeNanosUnsafe: () => clock.monotonicTimeNanosUnsafe(),
				sleep: (duration) => Queue.offer(state.sleeps, Duration.toMillis(duration)).pipe(Effect.andThen(clock.sleep(duration))),
			};
			const fixture = yield* codexServer((request) => {
				state.requests.push(request);
				if (request.method === "initialized") {
					return undefined;
				}
				return state.reply(request);
			}, state.handshakes);
			const authFile = yield* authFolder(state.token);
			const layer = state.cloud
				? cloudConfiguration(fixture.endpoint, authFile, {
						...state.options,
						...(state.refreshToken === undefined ? {} : { refreshCommand: refreshingCli(authFile, state.refreshToken) }),
					})
				: codexConfiguration(fixture.endpoint, state.localTimeout);
			state.observerScope = yield* Scope.fork(yield* Effect.scope);
			const acquired = yield* Layer.buildWithScope(layer, state.observerScope).pipe(Effect.provideService(Clock.Clock, state.clock), Effect.result);
			if (Result.isSuccess(acquired)) {
				state.transport = Context.get(acquired.success, SessionTransport);
			} else {
				if (!state.allowConnectionFailure) {
					return yield* Effect.fail(acquired.failure);
				}
				state.failure = acquired.failure;
			}
		},
	},
	clock: "live" as const,
	create: newProvider,
	inspect: (state: ProviderState) => state.requests,
	name: "codex provider",
	stages: ["configuration"] as const,
	verbs: (state: ProviderState, story: { tell: (line: string) => void }) => {
		const connected = Effect.suspend(() => {
			if (state.transport !== undefined) {
				return Effect.succeed(state.transport);
			}
			if (state.failure !== undefined) {
				return Effect.fail(state.failure);
			}
			return Effect.die("The provider was not acquired");
		});
		return {
			awaitSleep: (milliseconds: number) =>
				Effect.gen(function* () {
					story.tell(`wait until the provider schedules a ${milliseconds} millisecond delay`);
					let delay = yield* Queue.take(state.sleeps);
					while (delay !== milliseconds) {
						delay = yield* Queue.take(state.sleeps);
					}
				}),
			closeObserver: () => {
				story.tell("close the provider observer");
				if (state.observerScope === undefined) {
					return Effect.die("The provider observer did not start");
				}
				return Scope.close(state.observerScope, Exit.void);
			},
			handshakes: () => state.handshakes,
			provider: providerVerbs(connected, story.tell, state.clock),
			replyAfter: (milliseconds: number, response: unknown) => {
				if (state.clock === undefined) {
					throw new Error("The provider clock was not installed");
				}
				return Effect.runPromise(Effect.sleep(milliseconds).pipe(Effect.as(response), Effect.provideService(Clock.Clock, state.clock)));
			},
			replyWith: (reply: (request: WireRequest) => unknown) =>
				Effect.sync(() => {
					story.tell("the fake provider changes its responses");
					state.reply = reply;
				}),
			requests: () => state.requests,
		};
	},
};
export const providerStory = storyKit(definition);
export const timedProviderStory = storyKit({ ...definition, clock: "test" });
export const cloudProvider = providerStory.trait("configuration", "the client connects to Codex Cloud", (state) => {
	state.cloud = true;
});

export function cloudLogin(expired: boolean, rotate: boolean) {
	return providerStory.trait("configuration", "Cloud login requires a CLI refresh", (state) => {
		state.cloud = true;
		state.allowConnectionFailure = expired && !rotate;
		state.token = syntheticToken("expired", expired ? PAST_EXPIRY : FUTURE_EXPIRY);
		state.refreshToken = syntheticToken(rotate ? "rotated" : "expired", rotate ? FUTURE_EXPIRY : PAST_EXPIRY);
	});
}

export function cloudRecovery(graceMs: number) {
	return providerStory.trait("configuration", `Cloud recovery waits ${graceMs} milliseconds`, (state) => {
		state.cloud = true;
		state.options = { ...state.options, recoveryGraceMs: graceMs };
	});
}

export function localRequestTimeout(milliseconds: number) {
	return providerStory.trait("configuration", `local RPC allows ${milliseconds} milliseconds`, (state) => {
		state.localTimeout = milliseconds;
	});
}
