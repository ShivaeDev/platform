import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { decodeTemplate } from "#template.ts";
import type { Engine } from "./generate.ts";

const Ranges = Schema.Record(Schema.String, Schema.String);
const decodeManifest = Schema.decodeUnknownSync(
	Schema.fromJsonString(Schema.Struct({ dependencies: Ranges, devDependencies: Schema.optional(Ranges), scripts: Schema.optional(Ranges) })),
);
const decodeVersions = Schema.decodeUnknownSync(Schema.fromJsonString(Ranges));
const decodeFields = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));

function rangesOf(manifest: string) {
	const { dependencies, devDependencies } = decodeManifest(manifest);
	return { ...dependencies, ...devDependencies };
}

function pick(ranges: Readonly<Record<string, string>>, names: readonly string[]) {
	return Object.fromEntries(names.map((name) => [name, ranges[name] ?? "absent"]));
}

export function templateReadouts(engine: Engine) {
	function packed() {
		return new Map(decodeTemplate(readFileSync(engine.source.output, "utf8")).map((entry) => [entry.path, Buffer.from(entry.content, "base64")]));
	}
	function packedText(path: string) {
		return packed().get(path)?.toString() ?? "not packed";
	}
	function starterText(path: string) {
		return readFileSync(join(engine.source.starter, path), "utf8");
	}
	return {
		packedBytes: (path: string) => Effect.sync(() => packed().get(path) ?? "not packed"),
		packedFile: (path: string) => Effect.sync(() => packedText(path)),
		packedFiles: () => Effect.sync(() => Object.fromEntries([...packed()].map(([path, content]) => [path, content.toString()]))),
		packedManifest: () => Effect.sync(() => decodeManifest(packedText("package.json"))),
		packedRanges: (names: readonly string[]) => Effect.sync(() => pick(rangesOf(packedText("package.json")), names)),
		packedScript: (name: string) => Effect.sync(() => decodeManifest(packedText("package.json")).scripts?.[name] ?? "no such script"),
		packedWorkspaceRanges: () =>
			Effect.sync(() =>
				Object.entries(rangesOf(packedText("package.json")))
					.filter(([, range]) => range.startsWith("workspace:"))
					.map(([name, range]) => `${name}@${range}`),
			),
		starterFile: (path: string) => Effect.sync(() => starterText(path)),
		starterManifestFields: () => Effect.sync(() => Object.keys(decodeFields(starterText("package.json")))),
		starterPublishedVersions: (names: readonly string[]) => Effect.sync(() => pick(decodeVersions(starterText("published-versions.json")), names)),
		starterRanges: (names: readonly string[]) => Effect.sync(() => pick(rangesOf(starterText("package.json")), names)),
		starterScript: (name: string) => Effect.sync(() => decodeManifest(starterText("package.json")).scripts?.[name] ?? "no such script"),
	};
}
