import { Schema } from "effect";
export const UsageWindow = Schema.Struct({
	resetsAt: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000))),
	usedPercent: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0)),
	windowDurationMins: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
});
export type UsageWindow = typeof UsageWindow.Type;
export const CodexLimits = Schema.Struct({ primary: Schema.NullOr(UsageWindow), secondary: Schema.NullOr(UsageWindow) });
export type CodexLimits = typeof CodexLimits.Type;
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
const Timestamp = Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000_000));
export const GithubWindow = Schema.Struct({
	limit: Count,
	limitedBy: Schema.NullOr(Schema.Literals(["rate-limit", "reserve"])),
	limitedUntil: Schema.NullOr(Timestamp),
	observedAt: Timestamp,
	remaining: Count,
	reset: Count.check(Schema.isLessThanOrEqualTo(8_640_000_000_000)),
	resource: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
	used: Count,
});
export type GithubWindow = typeof GithubWindow.Type;
export const GithubLimits = Schema.Array(GithubWindow).check(Schema.isMaxLength(50));
export type GithubLimits = typeof GithubLimits.Type;

export type Observation<A> =
	| { readonly state: "ready"; readonly observedAt: number; readonly value: A }
	| { readonly state: "not-configured" | "error"; readonly observedAt: number; readonly cause: string; readonly startCommand?: string };
