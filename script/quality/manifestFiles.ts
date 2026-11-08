import { Effect, Result, Schema } from "effect";
import type { RuleInputs } from "@shivaedev/quality/rule.ts";

const Dependencies = Schema.Record(Schema.String, Schema.Unknown);
const Manifest = Schema.Struct({
	dependencies: Schema.optional(Dependencies),
	devDependencies: Schema.optional(Dependencies),
	name: Schema.optional(Schema.String),
	optionalDependencies: Schema.optional(Dependencies),
	overrides: Schema.optional(Schema.Unknown),
	peerDependencies: Schema.optional(Dependencies),
	pnpm: Schema.optional(Schema.Unknown),
	resolutions: Schema.optional(Schema.Unknown),
});
const decode = Schema.decodeUnknownResult(Schema.fromJsonString(Manifest));
const WORKSPACE_MANIFEST = /^(?:packages|examples)\/[^/]+\/package\.json$/u;

export const manifestFiles = Effect.fn("Quality.manifestFiles")(function* ({ files, readText }: Pick<RuleInputs, "files" | "readText">) {
	const paths = ["package.json", ...files.filter((file) => WORKSPACE_MANIFEST.test(file))];
	return yield* Effect.forEach(
		paths,
		(path) =>
			Effect.map(readText(path), (text) => {
				const decoded = decode(text);
				return { fields: Result.isFailure(decoded) ? undefined : decoded.success, path };
			}),
		{ concurrency: "unbounded" },
	);
});
