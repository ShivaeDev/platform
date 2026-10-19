import { Effect } from "effect";
import { type EngineStory, running } from "#test/engineState.ts";
import { PR, REPORT } from "#test/githubResult.ts";

export function engineSchedulingVerbs(state: EngineStory, tell: (line: string) => void) {
	function attempt<A, E>(effect: Effect.Effect<A, E>, action: string, id: string) {
		tell(`Fleet attempts to ${action} ${id}`);
		return effect.pipe(
			Effect.matchEffect({
				onFailure: Effect.succeed,
				onSuccess: () => Effect.die(new Error(`Expected ${action === "dispatch" ? "dispatching" : "continuing"} ${id} to fail, but it succeeded`)),
			}),
		);
	}
	function report(id: string, output: string) {
		return Effect.gen(function* () {
			tell(`the worker for ${id} finishes its turn`);
			const { fleet, fixture } = running(state);
			const receipt = (yield* fleet.get(id)).value.attempts.at(-1)?.receipt;
			const observation = receipt === undefined ? undefined : fixture.observations.get(receipt.turnId);
			if (observation === undefined) {
				return yield* Effect.die(new Error(`No worker turn to finish for ${id}`));
			}
			fixture.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output });
		});
	}
	return {
		answerDecision: Effect.fnUntraced(function* (id: string, action: "retry" | "release") {
			tell(`the human answers ${id}'s decision with ${action}`);
			const { fleet, fixture } = running(state);
			const decision = (yield* fleet.get(id)).value.decision;
			if (decision === undefined) {
				return yield* Effect.die(new Error(`No decision to answer for ${id}`));
			}
			return yield* fleet.resolve(id, decision.id, fixture.respond(decision.id, action));
		}),
		attemptContinue: (id: string, message: string) => attempt(running(state).fleet.continue(id, message), "continue", id),
		attemptDispatch: (id: string) => attempt(running(state).fleet.dispatch(id), "dispatch", id),
		commitBatches: () => state.commits,
		finishWorker: (id: string) => report(id, REPORT),
		providerQuota: (available: number) => {
			tell(`the provider now reports quota for ${available} submissions`);
			state.options = { ...state.options, quota: available };
		},
		recordedSchedulerLogs: () => state.logs.entries,
		reservePr: () => {
			tell("the PR reserves open-PR backlog");
			return running(state).fixture.foreign(PR);
		},
		reviseBrief: (id: string, revision: string) => {
			tell(`the approved Board brief for ${id} changes to ${revision}`);
			const { fixture } = running(state);
			fixture.editWork(id, revision);
			fixture.approveWork(id, revision);
		},
		unavailableWork: (id: string, unavailable: boolean) => {
			tell(`Board reads for ${id} are ${unavailable ? "unavailable" : "available"}`);
			running(state).fixture.unavailableWork(id, unavailable);
		},
		workerQuestion: (id: string, question: string) => report(id, `FLEET_QUESTION: ${question}`),
	};
}
