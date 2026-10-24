import { Layer } from "effect";
import { FleetPolicy } from "#policy.ts";
import { SessionFailure } from "#session/schema.ts";
import { enginePolicy } from "#test/enginePolicy.ts";
import { engineProvider } from "#test/engineProvider.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

const states = new WeakMap<HostStoryEngine, { now: number; reject: boolean; provider: ReturnType<typeof engineProvider> }>();
export function configureApprovalBackoff(engine: HostStoryEngine, rejectedCall: "session" | "turn", workerGuidance: string) {
	const state = { now: 100, provider: engineProvider({}, []), reject: true };
	state.provider = engineProvider(
		{
			submissionFailure: (call) =>
				state.reject && call === rejectedCall
					? new SessionFailure({ code: "session-queue-full", message: "Request queue is full", reason: "rejected" })
					: undefined,
		},
		[],
	);
	engine.provider = state.provider.transport;
	engine.parts = {
		...engine.parts,
		policy: Layer.succeed(FleetPolicy)(enginePolicy({ launch: { model: "queued-model" }, now: () => state.now, workerGuidance })),
	};
	states.set(engine, state);
}
export function approvalBackoffVerbs(engine: HostStoryEngine) {
	function state() {
		const value = states.get(engine);
		if (value === undefined) {
			throw new Error("Configure queued launches first");
		}
		return value;
	}
	return {
		acceptQueuedLaunches: () => {
			state().reject = false;
		},
		advanceLaunchTime: (now: number) => {
			state().now = now;
		},
		queuedProvider: () => state().provider,
	};
}
