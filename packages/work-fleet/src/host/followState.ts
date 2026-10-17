import { Option, Schema } from "effect";
import { DecisionCode } from "#DecisionCode.ts";
import { State, settled, WAIT_EXIT, type WaitOutcome } from "#host/waitOutcome.ts";
import { FleetRecord } from "#model.ts";

export interface FollowState extends Schema.Schema.Type<typeof State> {
	readonly undecoded?: string;
}

const Identity = Schema.Struct({ stage: Schema.optional(Schema.String), workId: Schema.optional(Schema.String) });

export function decodeFollowState(value: unknown): FollowState {
	const decoded = Schema.decodeUnknownOption(State)(value);
	if (Option.isSome(decoded)) {
		return decoded.value;
	}
	const fields = Option.getOrElse(Schema.decodeUnknownOption(Identity)(value), () => ({ stage: undefined, workId: undefined }));
	return { stage: fields.stage ?? "unknown", undecoded: JSON.stringify(value), workId: fields.workId ?? "unknown" };
}

export function unrecognizedState(state: FollowState): boolean {
	return (
		state.undecoded !== undefined || !knownStage(state.stage) || (state.decision?.code !== undefined && !Schema.is(DecisionCode)(state.decision.code))
	);
}

export function followOutcome(state: FollowState): WaitOutcome | undefined {
	if (state.undecoded !== undefined) {
		return { code: WAIT_EXIT.error, summary: `${state.workId} ${state.stage}: ${state.undecoded}` };
	}
	const outcome = settled(state.workId, state);
	const code = state.decision?.code;
	if (code !== undefined && !Schema.is(DecisionCode)(code)) {
		return { code: outcome?.code ?? WAIT_EXIT.error, summary: `${outcome?.summary ?? `${state.workId} ${state.stage}`}: ${code}` };
	}
	return outcome ?? (knownStage(state.stage) ? undefined : { code: WAIT_EXIT.error, summary: `${state.workId} ${state.stage}` });
}

function knownStage(stage: string) {
	return stage === "dispatching" || Schema.is(FleetRecord.fields.stage)(stage);
}
