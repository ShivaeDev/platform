import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import process from "node:process";
import { Effect, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";

const Defs = Schema.Struct({
	$defs: Schema.Record(Schema.String, Schema.Struct({ properties: Schema.optionalKey(Schema.Record(Schema.String, Schema.Unknown)) })),
});

const SCANNER_DOMAINS: ReadonlySet<string> = new Set(["project", "types"]);

function capitalized(group: string): string {
	return `${group.charAt(0).toUpperCase()}${group.slice(1)}`;
}

function biomeFiles() {
	const fromBiome = createRequire(createRequire(import.meta.url).resolve("@biomejs/biome/package.json"));
	const native = [`@biomejs/cli-${process.platform}-${process.arch}/biome`, `@biomejs/cli-${process.platform}-${process.arch}-musl/biome`].flatMap(
		(specifier) => {
			try {
				return [fromBiome.resolve(specifier)];
			} catch {
				return [];
			}
		},
	);
	const [binary] = native;
	if (binary === undefined) {
		throw new Error(`No Biome binary is installed for ${process.platform}-${process.arch}`);
	}
	return { binary, schema: fromBiome.resolve("@biomejs/biome/configuration_schema.json") };
}

// Every lint rule the installed Biome configures, as its diagnostic category.
function lintRules(schemaPath: string): readonly string[] {
	const { $defs } = Schema.decodeUnknownSync(Schema.fromJsonString(Defs))(readFileSync(schemaPath, "utf8"));
	const groups = Object.keys($defs.Rules?.properties ?? {}).filter((group) => $defs[capitalized(group)]?.properties !== undefined);
	return groups.flatMap((group) => Object.keys($defs[capitalized(group)]?.properties ?? {}).map((rule) => `lint/${group}/${rule}`));
}

function domainsOf(explanation: string): readonly string[] {
	const section = explanation.split(/^Domains$/mu)[1]?.split(/^Description$/mu)[0] ?? "";
	return [...section.matchAll(/^- Name: (?<domain>\w+)$/gmu)].flatMap((match) => match.groups?.domain ?? []);
}

export const scannerRuleList = Effect.fn("Biome.scannerRuleList")(function* () {
	const { binary, schema } = biomeFiles();
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const explained = yield* Effect.forEach(
		lintRules(schema),
		(category) =>
			Effect.map(spawner.string(ChildProcess.make(binary, ["explain", category.split("/")[2] ?? ""])), (text) => ({
				category,
				scans: domainsOf(text).some((domain) => SCANNER_DOMAINS.has(domain)),
			})),
		{ concurrency: 16 },
	);
	return explained.filter(({ scans }) => scans).map(({ category }) => category);
});
