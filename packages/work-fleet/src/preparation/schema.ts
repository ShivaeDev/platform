import { Schema } from "effect";

const Text = Schema.String.check(Schema.isMinLength(1));
export const RepositoryPath = Text.check(
	Schema.makeFilter(
		(value) =>
			value === "."
			|| (!(value.startsWith("/") || value.includes("\\"))
				&& value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".."))
			|| "Expected a normalized repository-relative path",
	),
);

export const ValidationEvidence = Schema.Struct({ command: Text, revision: Text });
export const ConfigurationCoverage = Schema.Struct({ path: RepositoryPath, relevantKeys: Schema.Array(Text) });
export const Preparation = Schema.Struct({
	baselinePaths: Schema.Array(RepositoryPath),
	baseRevision: Text,
	configuration: Schema.Array(ConfigurationCoverage),
	contextComplete: Schema.Boolean,
	dependencyPaths: Schema.Array(RepositoryPath),
	observedAt: Schema.Number,
	ownedPaths: Schema.Array(RepositoryPath).check(Schema.isMinLength(1)),
	qualityPaths: Schema.Array(RepositoryPath),
	setupPaths: Schema.Array(RepositoryPath),
	sourcePaths: Schema.Array(RepositoryPath),
	validation: Schema.Array(ValidationEvidence),
});
export type Preparation = typeof Preparation.Type;

export const ConfigurationChange = Schema.Struct({ complete: Schema.Boolean, keys: Schema.Array(Text), path: RepositoryPath });
export const MainObservation = Schema.Struct({
	ancestor: Schema.Boolean,
	changedPaths: Schema.Array(RepositoryPath),
	complete: Schema.Boolean,
	configurationChanges: Schema.Array(ConfigurationChange),
	fromRevision: Text,
	observedAt: Schema.Number,
	revision: Text,
});
export type MainObservation = typeof MainObservation.Type;

export const PreparationAssessment = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Compatible"), preparation: Preparation }),
	Schema.Struct({
		_tag: Schema.Literal("Reprepare"),
		paths: Schema.Array(RepositoryPath),
		reason: Schema.Literals(["not-ancestor", "incomplete-observation", "incomplete-context", "relevant-change"]),
	}),
]);
export type PreparationAssessment = typeof PreparationAssessment.Type;
