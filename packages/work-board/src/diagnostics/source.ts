import { Clock, Context, Effect, Schema } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import * as limits from "#browser/diagnostics/schema.ts";
import type { FleetHealth } from "./health.ts";

export class SourceFailure extends Schema.TaggedError<SourceFailure>()("SourceFailure", {
	kind: Schema.Literals(["not-configured", "error"]),
	message: Schema.String,
}) {}

export const { CodexLimits, GithubLimits, GithubWindow, UsageWindow } = limits;
export type CodexLimits = typeof CodexLimits.Type;
export type GithubLimits = typeof GithubLimits.Type;
export type GithubWindow = typeof GithubWindow.Type;
export type UsageWindow = typeof UsageWindow.Type;
export type Source<A> = Effect.Effect<A, SourceFailure>;
export interface Sources {
	readonly codex: Source<CodexLimits>;
	readonly fleet: Source<FleetHealth>;
	readonly github: Source<GithubLimits>;
}
export class DiagnosticsSources extends Context.Service<DiagnosticsSources, Sources>()("WorkBoard/DiagnosticsSources") {}

export type Observation<A> = limits.Observation<A>;

export const observe = Effect.fn("WorkBoard.observe")(function* <A>(source: Source<A>): Generator<Effect.Effect<unknown>, Observation<A>, never> {
	const result = yield* Effect.result(source);
	const observedAt = yield* Clock.currentTimeMillis;
	return result._tag === "Success"
		? { observedAt, state: "ready", value: result.success }
		: { cause: result.failure.message, observedAt, state: result.failure.kind };
});

export const diagnostics = Effect.fn("WorkBoard.diagnostics")(function* (sources: Sources) {
	const codex = yield* Effect.cachedWithTTL(observe(sources.codex), "1 minute");
	// A bounded shared read must finish caching even if its first tab leaves.
	return Effect.all(
		{ codex: Effect.uninterruptible(codex), fleet: observe(sources.fleet), github: observe(sources.github) },
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
