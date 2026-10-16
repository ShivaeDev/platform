import { Schema } from "effect";
import { CreateAppError } from "./CreateAppError.ts";

export const Versions = Schema.Record(Schema.String, Schema.String);
export const Template = Schema.Array(Schema.Struct({ content: Schema.String, path: Schema.String }));
export type Template = typeof Template.Type;
export const decodeTemplate = Schema.decodeUnknownSync(Schema.fromJsonString(Template));
const Manifest = Schema.Struct({
	dependencies: Versions,
	devDependencies: Versions,
	engines: Versions,
	imports: Versions,
	name: Schema.String,
	packageManager: Schema.String,
	private: Schema.Boolean,
	scripts: Versions,
	type: Schema.String,
	version: Schema.String,
});
const decodeManifest = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest));
// Decoding does not keep input key order, so the generated manifest lists its fields in package.json order.
const manifestOrder = [
	"name",
	"version",
	"private",
	"type",
	"imports",
	"scripts",
	"dependencies",
	"devDependencies",
	"packageManager",
	"engines",
] as const satisfies ReadonlyArray<keyof typeof Manifest.Type>;

export function registryDependencies(dependencies: Readonly<Record<string, string>>, versions: Readonly<Record<string, string>>) {
	return Object.fromEntries(
		Object.entries(dependencies).map(([name, version]) => {
			if (!version.startsWith("workspace:")) {
				return [name, version];
			}
			const published = versions[name];
			if (published === undefined || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(published)) {
				throw new CreateAppError({ message: `${name}: name an exact published version in published-versions.json` });
			}
			return [name, published];
		}),
	);
}

export function prepareManifest(source: string, versions: Readonly<Record<string, string>>) {
	const manifest = decodeManifest(source);
	const { "check:published": _check, ...scripts } = manifest.scripts;
	const prepared = {
		...manifest,
		dependencies: registryDependencies(manifest.dependencies, versions),
		devDependencies: registryDependencies(manifest.devDependencies, versions),
		scripts: Object.fromEntries(Object.entries(scripts).map(([name, script]) => [name, script.replaceAll("--conditions=source ", "")])),
	};
	return `${JSON.stringify(Object.fromEntries(manifestOrder.map((key) => [key, prepared[key]])), null, "\t")}\n`;
}

export function prepareFile(path: string, content: string, versions: Readonly<Record<string, string>>) {
	if (["src/server/dev.ts", "src/test-support/deployChild.ts"].includes(path)) {
		return content.replaceAll('"--conditions=source", ', "");
	}
	if (path === "package.json") {
		return prepareManifest(content, versions);
	}
	if (path === "biome.json") {
		return content.replace('"root": false', '"root": true');
	}
	if (["tsconfig.json", "vite.config.ts", "vitest.config.ts"].includes(path)) {
		return content.replaceAll('"source", ', "").replaceAll('["source"]', "[]");
	}
	return content;
}
