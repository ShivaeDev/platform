import * as Schema from "effect/Schema";

export const WAIT_EXIT = { completed: 0, error: 1, needsHuman: 2, released: 3, timeout: 4 } as const;

export interface WaitOutcome {
	readonly code: (typeof WAIT_EXIT)[keyof typeof WAIT_EXIT];
	readonly summary: string;
}

export const WaitState = Schema.Struct({
	blocker: Schema.optional(Schema.String),
	decision: Schema.optional(Schema.Struct({ reason: Schema.String })),
	outcome: Schema.optional(Schema.Struct({ evidence: Schema.optional(Schema.Array(Schema.String)), url: Schema.optional(Schema.String) })),
	stage: Schema.String,
});
export type WaitState = typeof WaitState.Type;

export function settled(workId: string, state: WaitState): WaitOutcome | undefined {
	if (state.stage === "completed") {
		const outcome = state.outcome?.url ?? state.outcome?.evidence?.join("; ");
		return { code: WAIT_EXIT.completed, summary: `${workId} completed${outcome ? `: ${outcome}` : ""}` };
	}
	if (state.stage === "needs-human") {
		return {
			code: WAIT_EXIT.needsHuman,
			summary: `${workId} needs-human: ${state.decision?.reason ?? state.blocker ?? "a Board decision is pending"}`,
		};
	}
	if (state.stage === "released") {
		return { code: WAIT_EXIT.released, summary: `${workId} released` };
	}
	return undefined;
}
