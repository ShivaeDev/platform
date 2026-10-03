import { posix } from "node:path";
import { Schema } from "effect";
import { decodeWith } from "../../../decoded.ts";
import type { RuleInputs } from "../../../rule.ts";

const Manifest = Schema.Struct({
	exports: Schema.optionalKey(Schema.Unknown),
	main: Schema.optionalKey(Schema.String),
	name: Schema.optionalKey(Schema.String),
});

type Manifest = typeof Manifest.Type;

const manifestSchema = Schema.toStandardSchemaV1(Schema.fromJsonString(Manifest));

const CONDITIONS: ReadonlySet<string> = new Set(["biome", "default"]);

const SPECIFIER = /^((?:@[^/]+\/)?[^/]+)(?:\/(.+))?$/;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

const targetOf = (value: unknown, star: string | undefined): string | undefined => {
	if (typeof value === "string") {
		return star === undefined ? value : value.replaceAll("*", star);
	}
	if (Array.isArray(value)) {
		return value.map((item: unknown) => targetOf(item, star)).find((target) => target !== undefined);
	}
	const condition = isRecord(value) ? Object.keys(value).find((key) => CONDITIONS.has(key)) : undefined;
	return isRecord(value) && condition !== undefined ? targetOf(value[condition], star) : undefined;
};

const bySpecificity = (left: string, right: string): number => right.indexOf("*") - left.indexOf("*") || right.length - left.length;

const patternTarget = (exports: Readonly<Record<string, unknown>>, key: string): string | undefined => {
	const pattern = Object.keys(exports)
		.filter((candidate) => candidate.split("*").length === 2)
		.sort(bySpecificity)
		.find((candidate) => {
			const [prefix = "", suffix = ""] = candidate.split("*");
			return key.startsWith(prefix) && key !== prefix && key.endsWith(suffix) && key.length >= candidate.length;
		});
	const [prefix = "", suffix = ""] = pattern?.split("*") ?? [];
	return pattern === undefined ? undefined : targetOf(exports[pattern], key.slice(prefix.length, key.length - suffix.length));
};

const exported = (exports: unknown, subpath: string): string | undefined => {
	const key = subpath === "" ? "." : `./${subpath}`;
	if (!isRecord(exports)) {
		return targetOf(exports, undefined);
	}
	return Object.hasOwn(exports, key) ? targetOf(exports[key], undefined) : (patternTarget(exports, key) ?? targetOf(exports, undefined));
};

const inPackage = (directory: string, target: string | undefined): string | undefined =>
	target?.startsWith("./") === true ? posix.join(directory, target) : undefined;

const manifestAt = async (readText: RuleInputs["readText"], path: string): Promise<Manifest | undefined> => {
	const text = await readText(path);
	const decoded = text === undefined ? undefined : await decodeWith(manifestSchema, text);
	return decoded?._tag === "Valid" ? decoded.value : undefined;
};

const fromDependency = (directory: string, manifest: Manifest, subpath: string): string | undefined => {
	if (manifest.exports !== undefined) {
		return inPackage(directory, exported(manifest.exports, subpath));
	}
	if (subpath === "" && manifest.main !== undefined) {
		return posix.join(directory, manifest.main);
	}
	return subpath === "" ? undefined : posix.join(directory, subpath);
};

export const resolvePackage = async (readText: RuleInputs["readText"], specifier: string): Promise<string | undefined> => {
	const [, name, subpath = ""] = SPECIFIER.exec(specifier) ?? [];
	if (name === undefined) {
		return undefined;
	}
	const own = await manifestAt(readText, "package.json");
	if (own?.name === name && own.exports !== undefined && subpath !== "") {
		return inPackage("", exported(own.exports, subpath));
	}
	const directory = posix.join("node_modules", name);
	const manifest = await manifestAt(readText, posix.join(directory, "package.json"));
	return manifest === undefined ? undefined : fromDependency(directory, manifest, subpath);
};
