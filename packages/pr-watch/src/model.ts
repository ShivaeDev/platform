import { Schema } from "effect";
import type { EventKind } from "#events.ts";
export class WatchError extends Schema.TaggedError<WatchError>()("WatchError", {
	message: Schema.String,
	retryAt: Schema.optionalKey(Schema.Number),
	retryable: Schema.optionalKey(Schema.Boolean),
}) {}
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
