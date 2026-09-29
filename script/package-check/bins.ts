import { basename, dirname, join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { Effect, FileSystem, Schema } from "effect";
import { command, requireThat } from "#package-check/io.ts";
import { bins, type Package, Versions } from "#package-check/model.ts";
import { checkServer } from "#package-check/server.ts";

const Case = Schema.Struct({
	args: Schema.Array(Schema.String),
	files: Versions,
	expectedFiles: Versions,
	output: Schema.optional(Schema.String),
	pages: Schema.optional(Versions),
	env: Schema.optional(Schema.Record(Schema.String, Schema.NullOr(Schema.String))),
	absent: Schema.optional(Schema.Array(Schema.String)),
	checkVersion: Schema.optional(Schema.Boolean),
});
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Case)));
export const checkBins = (root: string, pkg: Package, consumer: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const cases = decode(yield* fs.readFileString(join(root, "script/package-check/bin-cases.json")));
		for (const name of Object.keys(bins(pkg.manifest))) {
			const scenario = cases[name];
			if (scenario === undefined) return yield* Effect.fail(new Error(`${name}: add a real-work bin scenario`));
			for (const [path, content] of Object.entries(scenario.files)) {
				yield* fs.makeDirectory(dirname(join(consumer, path)), { recursive: true });
				yield* fs.writeFileString(join(consumer, path), content);
			}
			const bin = join(consumer, "node_modules/.bin", name);
			yield* checkVersion(consumer, bin, pkg.manifest.version, scenario.checkVersion);
			if (scenario.pages !== undefined) yield* checkServer(consumer, bin, scenario.args, scenario.pages);
			else {
				const output = yield* runBin(consumer, bin, scenario);
				yield* requireThat(output.includes(scenario.output ?? ""), `${name}: missing output ${scenario.output}`);
			}
			yield* checkResults(consumer, name, scenario);
		}
	});

const checkVersion = (consumer: string, bin: string, version: string, enabled: boolean | undefined) =>
	Effect.gen(function* () {
		if (!enabled) return;
		const output = stripVTControlCharacters(yield* command(consumer, bin, ["--version"])).trim();
		yield* requireThat(
			output === `${basename(bin)} v${version}`,
			`${bin}: --version reported ${JSON.stringify(output)}, expected ${basename(bin)} v${version}`,
		);
	});

const runBin = (consumer: string, bin: string, scenario: typeof Case.Type) => {
	const environment = Object.entries(scenario.env ?? {});
	const unset = environment.filter(([, value]) => value === null).flatMap(([key]) => ["-u", key]);
	const set = environment.flatMap(([key, value]) => (value === null ? [] : [`${key}=${value.replaceAll("{consumer}", consumer)}`]));
	return command(consumer, "env", [...unset, ...set, bin, ...scenario.args]);
};

const checkResults = (consumer: string, name: string, scenario: typeof Case.Type) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		for (const path of scenario.absent ?? []) yield* requireThat(!(yield* fs.exists(join(consumer, path))), `${name}: left ${path}`);
		for (const [path, expected] of Object.entries(scenario.expectedFiles)) {
			const content = yield* fs.readFileString(join(consumer, path));
			yield* requireThat(content.includes(expected), `${name}: ${path} did not contain ${expected}`);
		}
	});
