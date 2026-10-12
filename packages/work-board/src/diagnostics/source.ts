import { Clock, Context, Effect, Schema } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import type { FleetHealth } from "./health.ts";

export class SourceFailure extends Schema.TaggedError<SourceFailure>()("SourceFailure", {
	kind: Schema.Literals(["not-configured", "error"]),
	message: Schema.String,
}) {}

export const UsageWindow = Schema.Struct({
	resetsAt: Schema.NullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0), Schema.isLessThanOrEqualTo(8_640_000_000_000))),
	usedPercent: Schema.Number.check(Schema.isFinite(), Schema.isGreaterThanOrEqualTo(0)),
	windowDurationMins: Schema.NullOr(Schema.Int.check(Schema.isGreaterThan(0))),
});
export type UsageWindow = typeof UsageWindow.Type;
export const CodexLimits = Schema.Struct({ primary: Schema.NullOr(UsageWindow), secondary: Schema.NullOr(UsageWindow) });
export type CodexLimits = typeof CodexLimits.Type;
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const GithubWindow = Schema.Struct({ limit: Count, remaining: Count, reset: Count.check(Schema.isLessThanOrEqualTo(8_640_000_000_000)) });
export type GithubWindow = typeof GithubWindow.Type;
export const GithubLimits = Schema.Struct({ core: GithubWindow, graphql: GithubWindow });
export type GithubLimits = typeof GithubLimits.Type;
export type Source<A> = Effect.Effect<A, SourceFailure>;
export interface Sources {
	readonly codex: Source<CodexLimits>;
	readonly fleet: Source<FleetHealth>;
	readonly github: Source<GithubLimits>;
}
export class DiagnosticsSources extends Context.Service<DiagnosticsSources, Sources>()("WorkBoard/DiagnosticsSources") {}

export type Observation<A> =
	| { readonly state: "ready"; readonly observedAt: number; readonly value: A }
	| { readonly state: "not-configured" | "error"; readonly observedAt: number; readonly cause: string };

export const observe = Effect.fn("WorkBoard.observe")(function* <A>(source: Source<A>): Generator<Effect.Effect<unknown>, Observation<A>, never> {
	const result = yield* Effect.result(source);
	const observedAt = yield* Clock.currentTimeMillis;
	return result._tag === "Success"
		? { observedAt, state: "ready", value: result.success }
		: { cause: result.failure.message, observedAt, state: result.failure.kind };
});

export const diagnostics = Effect.fn("WorkBoard.diagnostics")(function* (sources: Sources) {
	const codex = yield* Effect.cachedWithTTL(observe(sources.codex), "1 minute");
	const github = yield* Effect.cachedWithTTL(observe(sources.github), "1 minute");
	// A bounded shared read must finish caching even if its first tab leaves.
	return Effect.all(
		{ codex: Effect.uninterruptible(codex), fleet: observe(sources.fleet), github: Effect.uninterruptible(github) },
		{ concurrency: "unbounded" },
	);
});

type DiagnosticsInput =
	| { readonly _tag: "Sources"; readonly sources: Sources }
	| { readonly _tag: "Read"; readonly read: Effect.Success<ReturnType<typeof diagnostics>> };

export class DiagnosticsConfig extends Context.Service<DiagnosticsConfig, DiagnosticsInput>()("WorkBoard/DiagnosticsConfig") {}

export const Diagnostics = defineService({
	id: "WorkBoard/Diagnostics",
	initialize: Effect.gen(function* () {
		const input = yield* DiagnosticsConfig;
		return input._tag === "Sources" ? yield* diagnostics(input.sources) : input.read;
	}),
	methods: (read) => ({ read: () => read }),
	requires: [DiagnosticsConfig],
});
export type Diagnostics = typeof Diagnostics.Identifier;
