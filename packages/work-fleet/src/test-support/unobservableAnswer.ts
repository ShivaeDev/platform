import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { Decision } from "#policy.ts";
import { prepareWork } from "#test/engine.ts";
import { workerTurnsCanBeLost } from "#test/engineLostTurnTraits.ts";
import { running } from "#test/engineState.ts";
import { engine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

export const ANSWER_INSTRUCTIONS = "Use the existing PostgreSQL dependency and preserve the transaction boundary.";

export function unobservableAnswer(legacy: boolean | "parked" = false) {
	return engine.traits(
		workerTurnsCanBeLost(),
		nativeStalledTurn(),
		engine.trait(
			"work",
			legacy === "parked"
				? "an older daemon retained an invisible answer decision on an active thread"
				: "the accepted answer disappears while an unrelated turn stays active",
			function* (state) {
				const fleet = running(state).fleet;
				running(state).fixture.areas("one", ["identity", "server"]);
				yield* prepareWork("one").pipe(Effect.provideService(Fleet, fleet));
				yield* fleet.dispatch("one");
				const server = state.recovery.native;
				if (server === undefined) {
					throw new Error("Expected a native provider");
				}
				server.complete("turn-1", "FLEET_QUESTION: May I use the existing dependency?");
				const question = (yield* fleet.reconcile("one")).value.decision;
				if (question === undefined) {
					throw new Error("Expected a worker question");
				}
				const response = running(state).fixture.respond(question.id, "retry", "answer", ANSWER_INSTRUCTIONS);
				yield* fleet.resolve("one", question.id, response);
				server.hidden.add("turn-2");
				server.states.set("unrelated-turn", "inProgress");
				if (legacy) {
					const stored = (yield* fleet.get("one")).value;
					yield* running(state).fixture.replaceRecord(legacySnapshot(stored, question, legacy === "parked"));
				}
			},
		),
	);
}

function legacySnapshot(record: FleetRecord, question: Decision, parked: boolean): FleetRecord {
	const latest = record.attempts.at(-1)?.operationId;
	return {
		...record,
		attempts: record.attempts.map(({ answerTurn: _answerTurn, ...attempt }) => ({
			...attempt,
			missingSince: attempt.operationId === latest ? 0 : undefined,
		})),
		decision: parked
			? {
					...question,
					code: "session-turn-missing",
					reason: "Accepted Codex turn is not observable; thread remains active after the visibility grace period; retain execution ownership",
					worker: undefined,
				}
			: record.decision,
		step: parked ? "waiting" : record.step,
	};
}
