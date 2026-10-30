import { Schema } from "effect";

const Dependencies = Schema.Record(Schema.String, Schema.String);

export const PackageManifest = Schema.Struct({
	bin: Schema.optionalKey(Schema.Union([Schema.String, Dependencies])),
	dependencies: Schema.optionalKey(Dependencies),
	devDependencies: Schema.optionalKey(Dependencies),
	engines: Schema.optionalKey(Dependencies),
	exports: Schema.optionalKey(Schema.Unknown),
	imports: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)),
	main: Schema.optionalKey(Schema.String),
	name: Schema.optionalKey(Schema.String),
	optionalDependencies: Schema.optionalKey(Dependencies),
	packageManager: Schema.optionalKey(Schema.String),
	peerDependencies: Schema.optionalKey(Dependencies),
	private: Schema.optionalKey(Schema.Boolean),
	quality: Schema.optionalKey(Schema.Struct({ runtime: Schema.optionalKey(Schema.Unknown) })),
	repository: Schema.optionalKey(Schema.Unknown),
	scripts: Schema.optionalKey(Dependencies),
	workspaces: Schema.optionalKey(Schema.Union([Schema.Array(Schema.String), Schema.Struct({ packages: Schema.Array(Schema.String) })])),
});

export type PackageManifest = typeof PackageManifest.Type;
