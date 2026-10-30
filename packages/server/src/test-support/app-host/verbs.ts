import { Cause, Effect, Option } from "effect";
import { adminVerbs } from "./adminVerbs.ts";
import { clientAbortVerbs } from "./clientAbortVerbs.ts";
import { connectionBackends, serverTls } from "./connectionSecurity.ts";
import { databaseVerbs } from "./databaseVerbs.ts";
import { close, hasService } from "./lifecycle.ts";
import { requests } from "./requests.ts";
import { runtimeVerbs } from "./runtime.ts";
import type { HostState } from "./state.ts";
import { subscriptionVerbs } from "./subscription.ts";
import { timeoutVerbs } from "./timeoutVerbs.ts";
import { traceVerbs } from "./traceVerbs.ts";

export function hostVerbs(state: HostState, story: { tell: (line: string) => void }) {
	return {
		...adminVerbs(state, story.tell),
		connectionBackends,
		serverTls,
		...requests(state, story.tell),
		...clientAbortVerbs(state, story.tell),
		...databaseVerbs(state, story.tell),
		...runtimeVerbs(state, story.tell),
		...traceVerbs(state),
		...timeoutVerbs(state, story.tell),
		...subscriptionVerbs(state),
		address: () => state.address,
		bootFailure: () => {
			if (state.bootFailure === undefined) {
				throw new Error("Startup did not fail");
			}
			return state.bootFailure;
		},
		calls: () => state.calls,
		clearCalls: () => {
			state.calls.length = 0;
		},
		close: () => {
			story.tell("the app host shuts down");
			return close(state);
		},
		hasService: <TIdentifier, TService>(service: Parameters<typeof hasService<TIdentifier, TService>>[1]) => hasService(state, service),
		hostAddress: () => state.bindAddress,
		lifecycle: () => state.lifecycle,
		lookups: () => state.lookups,
		reachable: (value: boolean) =>
			Effect.sync(() => {
				state.proxy?.setReachable(value);
			}),
		responsive: (value: boolean) =>
			Effect.sync(() => {
				state.proxy?.setResponsive(value);
			}),
		runtimeLifecycle: () => state.runtimeLifecycle,
		startupFailure: () => Option.getOrThrow(Cause.findErrorOption(state.bootFailure ?? Cause.empty)),
	};
}
