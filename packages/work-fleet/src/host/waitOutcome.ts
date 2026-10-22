import * as Schema from "effect/Schema";
import { ANSWER_RECORDED, AttentionOwner, waitingOwner } from "#attention.ts";

export const WAIT_EXIT = { completed: 0, error: 1, released: 3, timeout: 4, waitingDecision: 2 } as const;

export interface WaitOutcome {
	readonly code: (typeof WAIT_EXIT)[keyof typeof WAIT_EXIT];
	readonly summary: string;
}

export const WaitState = Schema.Struct({
	attentionOwner: Schema.optional(AttentionOwner),
	blocker: Schema.optional(Schema.String),
	checks: Schema.optional(Schema.Struct({ pending: Schema.optional(Schema.Boolean) })),
	decision: Schema.optional(
		Schema.Struct({
			attentionOwner: Schema.optional(AttentionOwner),
			code: Schema.optional(Schema.String),
			id: Schema.optional(Schema.String),
			reason: Schema.String,
		}),
	),
	outcome: Schema.optional(Schema.Struct({ evidence: Schema.optional(Schema.Array(Schema.String)), url: Schema.optional(Schema.String) })),
	recovery: Schema.optional(Schema.String),
	stage: Schema.String,
});
export type WaitState = typeof WaitState.Type;

export const State = Schema.Struct({ ...WaitState.fields, workId: Schema.String });

export function settled(workId: string, state: WaitState): WaitOutcome | undefined {
	if (state.blocker === ANSWER_RECORDED) {
		return undefined;
	}
	const owner = waitingOwner({ ...state, step: state.stage });
	const attention = owner === undefined ? "" : ` (waiting on ${owner === "maintainer" ? "you" : owner})`;
	if (state.stage === "done") {
		const outcome = state.outcome?.url ?? state.outcome?.evidence?.join("; ");
		return { code: WAIT_EXIT.completed, summary: `${workId} done${attention}${outcome ? `: ${outcome}` : ""}` };
	}
	if (state.stage === "waiting") {
		return {
			code: WAIT_EXIT.waitingDecision,
			summary: `${workId} waiting${attention}: ${state.blocker ?? state.decision?.reason ?? "a Board decision is pending"}`,
		};
	}
	if (state.stage === "released") {
		return { code: WAIT_EXIT.released, summary: `${workId} released${attention}` };
	}
	return undefined;
}
