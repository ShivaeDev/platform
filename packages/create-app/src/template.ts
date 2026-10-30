import { Buffer } from "node:buffer";
import { Schema } from "effect";
import { CreateAppError } from "#CreateAppError.ts";

export const Versions = Schema.Record(Schema.String, Schema.String);
export const Template = Schema.Array(Schema.Struct({ content: Schema.String, path: Schema.String }));
export type Template = typeof Template.Type;
export const decodeTemplate = Schema.decodeUnknownSync(Schema.fromJsonString(Template));

export function appTemplate(template: Template, minimal = false): Template {
	const minimalBaseline = template.find((entry) => entry.path === "quality-baseline.minimal.jsonl");
	const files = template.filter((entry) => entry.path !== "quality-baseline.minimal.jsonl");
	if (!minimal) {
		return files;
	}
	return files
		.filter((entry) => !entry.path.startsWith("src/modules/notes/"))
		.map((entry) => {
			if (entry.path === "quality-baseline.jsonl" && minimalBaseline !== undefined) {
				return { ...entry, content: minimalBaseline.content };
			}
			if (!["src/server/modules.ts", "src/server/workerModules.ts", "src/client/modules.ts"].includes(entry.path)) {
				return entry;
			}
			const source = Buffer.from(entry.content, "base64")
				.toString()
				.replace(/^import .* from "#modules\/notes\/.*";\n/gmu, "")
				.replace(/,?\s*\b(?:notesRegistration|notesWorker)\b/gu, "");
			return { ...entry, content: Buffer.from(source).toString("base64") };
		});
}

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

export function prepareFile(path: string, content: Buffer, versions: Readonly<Record<string, string>>) {
	if (["src/test-support/adminCommand.ts", "src/test-support/deployChild.ts", "src/test-support/developmentServer.ts"].includes(path)) {
		return Buffer.from(content.toString().replaceAll('"--conditions=source", ', ""));
	}
	if (path === "package.json") {
		return Buffer.from(prepareManifest(content.toString(), versions));
	}
	if (["tsconfig.json", "vite.config.ts", "vitest.config.ts", "src/server/dev.ts"].includes(path)) {
		return Buffer.from(content.toString().replaceAll('"source", ', "").replaceAll('["source"]', "[]"));
	}
	return content;
}
