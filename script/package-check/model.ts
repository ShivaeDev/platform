import { Schema } from "effect";

export const Versions = Schema.Record(Schema.String, Schema.String);
const Bin = Schema.Union([Schema.String, Versions]);
export const Manifest = Schema.Struct({
	bin: Schema.optional(Bin),
	dependencies: Schema.optional(Versions),
	devDependencies: Schema.optional(Versions),
	exports: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
	files: Schema.optional(Schema.Array(Schema.String)),
	imports: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
	name: Schema.String,
	optionalDependencies: Schema.optional(Versions),
	peerDependencies: Schema.optional(Versions),
	peerDependenciesMeta: Schema.optional(Schema.Record(Schema.String, Schema.Struct({ optional: Schema.optional(Schema.Boolean) }))),
	private: Schema.optional(Schema.Boolean),
	publishConfig: Schema.optional(Schema.Struct({ bin: Schema.optional(Bin) })),
	types: Schema.optional(Schema.String),
	version: Schema.String,
});
export type Manifest = typeof Manifest.Type;
export interface Package {
	readonly directory: string;
	readonly manifest: Manifest;
	readonly tarball: string;
}
export const decodeManifest = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest));
export const decodeVersions = Schema.decodeUnknownSync(Schema.fromJsonString(Versions));
export const dependencyKeys = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;
export function effectPackage(name: string): boolean {
	return name === "effect" || name.startsWith("@effect/");
}
// pnpm packs publishConfig.bin in place of bin, so the published executables are judged by it.
export function bins(manifest: Manifest): Readonly<Record<string, string>> {
	const bin = manifest.publishConfig?.bin ?? manifest.bin;
	return typeof bin === "string" ? { [manifest.name.split("/").at(-1) ?? manifest.name]: bin } : (bin ?? {});
}
export function targets(value: unknown): string[] {
	if (typeof value === "string") {
		return [value];
	}
	if (typeof value !== "object" || value === null) {
		return [];
	}
	return Object.values(value).flatMap(targets);
}
