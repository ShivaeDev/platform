import { Effect, Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import type { FleetError } from "#errors.ts";

const RulePages = Schema.Array(Schema.Array(Schema.Struct({ parameters: Schema.optional(Schema.Unknown), type: Schema.String })));
const RequiredParameters = Schema.Struct({ requiredStatusChecks: Schema.Array(Schema.Struct({ context: Schema.String })) }).pipe(
	Schema.encodeKeys({ requiredStatusChecks: "required_status_checks" }),
);

export function githubRequiredChecks<R>(read: (endpoint: string) => Effect.Effect<string, FleetError, R>, repository: string, branch: string) {
	return Effect.gen(function* () {
		const pages = yield* read(`repos/${repository}/rules/branches/${encodeURIComponent(branch)}`).pipe(
			Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(RulePages))),
		);
		const rules = pages.flat().filter((rule) => rule.type === "required_status_checks");
		const parameters = yield* Effect.forEach(rules, (rule) => Schema.decodeUnknownEffect(RequiredParameters)(rule.parameters));
		return [...new Set(parameters.flatMap((rule) => rule.requiredStatusChecks.map((check) => check.context)))];
	}).pipe(Effect.mapError(() => new ServiceUnavailable({ message: "GitHub required status checks are unavailable or invalid" })));
}
