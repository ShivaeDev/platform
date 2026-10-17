import { Schema } from "effect";

export const Versions = Schema.Record(Schema.String, Schema.String);
export const Manifest = Schema.Struct({
	bin: Schema.optional(Schema.Union([Schema.String, Versions])),
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
export function bins(manifest: Manifest): Readonly<Record<string, string>> {
	return typeof manifest.bin === "string" ? { [manifest.name.split("/").at(-1) ?? manifest.name]: manifest.bin } : (manifest.bin ?? {});
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
