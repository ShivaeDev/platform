import { Schema } from "effect";
export const Bump = Schema.Literals(["patch", "minor", "major"]);
export type Bump = typeof Bump.Type;
export const Source = Schema.Struct({ name: Schema.String, text: Schema.String });
export type Source = typeof Source.Type;
const Versions = Schema.Record(Schema.String, Schema.String);
export const PackageManifest = Schema.Struct({
	dependencies: Schema.optional(Versions),
	name: Schema.String,
	optionalDependencies: Schema.optional(Versions),
	peerDependencies: Schema.optional(Versions),
	private: Schema.optional(Schema.Boolean),
	version: Schema.String,
});
export type PackageManifest = typeof PackageManifest.Type;
export interface WorkspacePackage {
	readonly changelog: string;
	readonly directory: string;
	readonly json: Readonly<Record<string, unknown>>;
	readonly manifest: PackageManifest;
}
export const Release = Schema.Struct({
	bump: Bump,
	directory: Schema.String,
	from: Schema.String,
	name: Schema.String,
	to: Schema.String,
});
export type Release = typeof Release.Type;
export const ReleasePlan = Schema.Struct({ changesets: Schema.Array(Source), releases: Schema.Array(Release) });
export type ReleasePlan = typeof ReleasePlan.Type;
export const ReleaseManifest = Schema.Struct({ date: Schema.String, plan: ReleasePlan });
export type ReleaseManifest = typeof ReleaseManifest.Type;
export interface Workspace {
	readonly changesets: readonly Source[];
	readonly packages: readonly WorkspacePackage[];
	readonly release: ReleaseManifest | undefined;
}
