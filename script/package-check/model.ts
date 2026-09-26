import { Schema } from "effect";

export const Versions = Schema.Record(Schema.String, Schema.String);
export const Manifest = Schema.Struct({
	name: Schema.String,
	version: Schema.String,
	private: Schema.optional(Schema.Boolean),
	exports: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
	types: Schema.optional(Schema.String),
	bin: Schema.optional(Schema.Union([Schema.String, Versions])),
	files: Schema.optional(Schema.Array(Schema.String)),
	dependencies: Schema.optional(Versions),
	devDependencies: Schema.optional(Versions),
	optionalDependencies: Schema.optional(Versions),
	peerDependencies: Schema.optional(Versions),
	peerDependenciesMeta: Schema.optional(Schema.Record(Schema.String, Schema.Struct({ optional: Schema.optional(Schema.Boolean) }))),
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
export const effectPackage = (name: string): boolean => name === "effect" || name.startsWith("@effect/");
export const bins = (manifest: Manifest): Readonly<Record<string, string>> =>
	typeof manifest.bin === "string" ? { [manifest.name.split("/").at(-1) ?? manifest.name]: manifest.bin } : (manifest.bin ?? {});
export const targets = (value: unknown): string[] => {
	if (typeof value === "string") return [value];
	if (typeof value !== "object" || value === null) return [];
	return Object.values(value).flatMap(targets);
};
