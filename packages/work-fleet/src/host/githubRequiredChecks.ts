import { Effect, Schema } from "effect";
import type { FleetError } from "#errors.ts";
import { githubFailure } from "#host/githubRateLimit.ts";

const RulePages = Schema.Array(Schema.Array(Schema.Struct({ parameters: Schema.optional(Schema.Unknown), type: Schema.String })));
const RequiredParameters = Schema.Struct({ requiredStatusChecks: Schema.Array(Schema.Struct({ context: Schema.String })) }).pipe(
	Schema.encodeKeys({ requiredStatusChecks: "required_status_checks" }),
);

const BranchPages = Schema.Array(
	Schema.Struct({
		protected: Schema.Boolean,
		protection: Schema.optional(
			Schema.Struct({
				requiredStatusChecks: Schema.optional(Schema.Struct({ contexts: Schema.Array(Schema.String) })),
			}).pipe(Schema.encodeKeys({ requiredStatusChecks: "required_status_checks" })),
		),
	}),
);

export function githubRequiredChecks<R>(read: (endpoint: string) => Effect.Effect<string, FleetError, R>, repository: string, branch: string) {
	return Effect.gen(function* () {
		const encodedBranch = encodeURIComponent(branch);
		const branches = yield* read(`repos/${repository}/branches/${encodedBranch}`).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(BranchPages))),
		);
		const protectedContexts = branches.flatMap((observed) => (observed.protected ? (observed.protection?.requiredStatusChecks?.contexts ?? []) : []));
		const pages = yield* read(`repos/${repository}/rules/branches/${encodedBranch}`).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(RulePages))),
		);
		const rules = pages.flat().filter((rule) => rule.type === "required_status_checks");
		const parameters = yield* Effect.forEach(rules, (rule) => Schema.decodeUnknownEffect(RequiredParameters)(rule.parameters));
		return [...new Set([...protectedContexts, ...parameters.flatMap((rule) => rule.requiredStatusChecks.map((check) => check.context))])];
	}).pipe(Effect.mapError(githubFailure("GitHub required status checks are unavailable or invalid")));
}
