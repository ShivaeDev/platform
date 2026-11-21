import { Effect, Schema } from "effect";
import * as Base64 from "effect/encoding/Base64";
import { CreateAppError } from "#CreateAppError.ts";
import { bytesOf, textOf } from "#fileContent.ts";
import { frameworkCatalog, frameworkDependencies } from "#frameworkCatalog.ts";

export const Versions = Schema.Record(Schema.String, Schema.String);
export const Template = Schema.Array(Schema.Struct({ content: Schema.String, path: Schema.String }));
export type Template = typeof Template.Type;
export const decodeTemplate = Schema.decodeUnknownSync(Schema.fromJsonString(Template));

const rewrittenMinimalFiles = new Set([
	"src/admin/foundation.ts",
	"src/admin/modules.ts",
	"src/server/modules.ts",
	"src/server/workerModules.ts",
	"src/client/modules.ts",
]);

export const appTemplate = Effect.fn("CreateApp.appTemplate")(function* (template: Template, minimal = false) {
	const minimalManifest = template.find((entry) => entry.path === "package.minimal.json");
	const files = template.filter((entry) => entry.path !== "package.minimal.json");
	if (!minimal) {
		return files;
	}
	return yield* Effect.forEach(
		files.filter((entry) => !entry.path.startsWith("src/modules/notes/")),
		Effect.fnUntraced(function* (entry: Template[number]): Effect.fn.Return<Template[number], CreateAppError> {
			if (entry.path === "package.json" && minimalManifest !== undefined) {
				return { ...entry, content: minimalManifest.content };
			}
			// Updates must reconstruct historical minimal files exactly to recognize unmodified deletions.
			if (!rewrittenMinimalFiles.has(entry.path)) {
				return entry;
			}
			const bytes = yield* Effect.fromResult(Base64.decode(entry.content)).pipe(
				Effect.mapError((cause) => new CreateAppError({ message: `Failed to render template file ${entry.path}` }, { cause })),
			);
			const source = textOf(bytes)
				.replace(/^import .* from "#modules\/notes\/.*";\n/gmu, "")
				.replace(/,?\s*\b(?:noteQueue|notesModule|notesRegistration|notesWorker)\b/gu, "");
			return { ...entry, content: Base64.encode(bytesOf(source)) };
		}),
	);
});

const Manifest = Schema.Struct({
	dependencies: Versions,
	devDependencies: Versions,
	engines: Versions,
	imports: Versions,
	name: Schema.String,
	packageManager: Schema.String,
	private: Schema.Boolean,
	quality: Schema.optional(Schema.Unknown),
	scripts: Versions,
	shivaedevSkills: Schema.optional(Schema.Array(Schema.String)),
	type: Schema.String,
	version: Schema.String,
});
export const decodeManifest = Schema.decodeUnknownSync(Schema.fromJsonString(Manifest));
const decodeManifestEffect = Schema.decodeUnknownEffect(Schema.fromJsonString(Manifest));
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
	"quality",
	"shivaedevSkills",
] as const satisfies ReadonlyArray<keyof typeof Manifest.Type>;

export function manifestJson(manifest: typeof Manifest.Type) {
	return `${JSON.stringify(Object.fromEntries(manifestOrder.map((key) => [key, manifest[key]])), null, "\t")}\n`;
}

export const registryDependencies = Effect.fn("CreateApp.registryDependencies")(function* (
	dependencies: Readonly<Record<string, string>>,
	versions: Readonly<Record<string, string>>,
) {
	const pinned: Array<readonly [string, string]> = [];
	for (const [name, version] of Object.entries(dependencies)) {
		if (!version.startsWith("workspace:")) {
			pinned.push([name, version]);
			continue;
		}
		const published = versions[name];
		if (published === undefined || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/u.test(published)) {
			return yield* new CreateAppError({ message: `${name}: name an exact published version in published-versions.json` });
		}
		pinned.push([name, published]);
	}
	return Object.fromEntries(pinned);
});

export const prepareManifest = Effect.fn("CreateApp.prepareManifest")(function* (
	source: string,
	versions: Readonly<Record<string, string>>,
	minimal = false,
	cataloged = false,
) {
	const manifest = yield* decodeManifestEffect(source);
	const { "check:published": _check, ...scripts } = manifest.scripts;
	const prepared = {
		...manifest,
		dependencies: frameworkDependencies(
			manifest.dependencies,
			yield* registryDependencies(
				Object.fromEntries(Object.entries(manifest.dependencies).filter(([name]) => !minimal || name !== "@tanstack/react-table")),
				versions,
			),
			cataloged,
		),
		devDependencies: frameworkDependencies(manifest.devDependencies, yield* registryDependencies(manifest.devDependencies, versions), cataloged),
		scripts: Object.fromEntries(Object.entries(scripts).map(([name, script]) => [name, script.replaceAll("--conditions=@shivaedev/source ", "")])),
	};
	return manifestJson(prepared);
});

export const prepareFile = Effect.fn("CreateApp.prepareFile")(function* (
	path: string,
	content: Uint8Array,
	versions: Readonly<Record<string, string>>,
	cataloged = false,
) {
	if (["src/test-support/admin/command.ts", "src/test-support/deployChild.ts", "src/test-support/developmentServer.ts"].includes(path)) {
		return bytesOf(textOf(content).replaceAll('"--conditions=@shivaedev/source", ', ""));
	}
	if (path === "package.json") {
		return bytesOf(yield* prepareManifest(textOf(content), versions, false, cataloged));
	}
	if (path === "pnpm-workspace.copy.yaml" && cataloged) {
		return bytesOf(frameworkCatalog(textOf(content), versions));
	}
	if (["tsconfig.json", "vite.config.ts", "vitest.config.ts", "src/server/dev.ts"].includes(path)) {
		return bytesOf(textOf(content).replaceAll('["@shivaedev/source"]', "[]"));
	}
	return content;
});
