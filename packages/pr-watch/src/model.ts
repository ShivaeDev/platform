import { Schema } from "effect";
import type { EventKind } from "#events.ts";

const WatchFailure = Schema.Struct({
	message: Schema.String,
	reason: Schema.Literals(["arguments", "response", "state", "cooldown", "outage", "output"]),
	retryAt: Schema.optionalKey(Schema.Number),
});
export class WatchError extends Schema.TaggedError<WatchError>()("WatchError", WatchFailure) {
	constructor(fields: typeof WatchFailure.Type, options?: ErrorOptions) {
		super(fields);
		Object.defineProperty(this, "cause", { value: options?.cause });
	}
}
export const Snapshot = Schema.Struct({
	autoMerge: Schema.Boolean,
	branch: Schema.String,
	dequeueReason: Schema.optionalKey(Schema.String),
	dirty: Schema.Boolean,
	failed: Schema.Boolean,
	merged: Schema.Boolean,
	number: Schema.Int,
	queued: Schema.Boolean,
	state: Schema.Literals(["open", "closed"]),
	title: Schema.String,
});
export type Snapshot = typeof Snapshot.Type;
export const State = Schema.Struct({
	openNumbers: Schema.optionalKey(Schema.Array(Schema.Int)),
	prs: Schema.Record(Schema.String, Snapshot),
	repository: Schema.String,
	version: Schema.Literal(1),
});
export type State = typeof State.Type;
export interface Options {
	readonly apiUrl: string;
	readonly events?: readonly EventKind[];
	readonly fleet: boolean;
	readonly interval: number;
	readonly numbers: readonly number[];
	readonly repository: string;
	readonly stateFile: string;
}
