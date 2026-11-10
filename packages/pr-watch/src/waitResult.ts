import { Runtime, Schema } from "effect";
import { FailedCheck } from "#model.ts";

const prFields = { head: Schema.optionalKey(Schema.String), number: Schema.Int };

export const WaitPending = Schema.Struct({
	...prFields,
	mergeableState: Schema.optionalKey(Schema.String),
	pending: Schema.Literals(["observation", "mergeability", "merge queue", "required checks"]),
});
export type WaitPending = typeof WaitPending.Type;

export const WaitResult = Schema.Union([
	Schema.Struct({ ...prFields, result: Schema.Literals(["passed", "conflict", "merged", "closed"]) }),
	Schema.Struct({ ...prFields, checks: Schema.Array(FailedCheck), result: Schema.Literal("checks-failed") }),
	Schema.Struct({ ...prFields, reason: Schema.String, result: Schema.Literal("dequeued") }),
	Schema.Struct({ ...WaitPending.fields, result: Schema.Literal("timeout") }),
]);
export type WaitResult = typeof WaitResult.Type;

export const waitExitCodes = {
	"checks-failed": 2,
	closed: 6,
	conflict: 3,
	dequeued: 4,
	merged: 5,
	passed: 0,
	timeout: 7,
} as const satisfies Record<WaitResult["result"], number>;

export class WaitEnded extends Schema.TaggedError<WaitEnded>()("WaitEnded", {
	result: Schema.Literals(["checks-failed", "closed", "conflict", "dequeued", "merged", "timeout"]),
}) {
	override get [Runtime.errorExitCode]() {
		return waitExitCodes[this.result];
	}
}

const encode = Schema.encodeSync(Schema.fromJsonString(WaitResult));
export function encodeWaitResult(result: WaitResult): string {
	return `${encode(result)}\n`;
}
