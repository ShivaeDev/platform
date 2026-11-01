import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { biomeFormatted, exceptionStory, repositoryHas } from "#test/exceptionStory.ts";
import { config } from "#test/tree.ts";

const UNTYPED = { content: "export function parse(text: string): any {\n\treturn JSON.parse(text);\n}\n", path: "src/parse.ts" };
const TYPED = { ...UNTYPED, content: UNTYPED.content.replace("any", "unknown") };
const ANY = "biome/lint/suspicious/noExplicitAny";
const REASON = "The external format requires it.";

exceptionStory.it(
	"quality baseline write cannot hide a stale Biome exception from quality lint",
	[
		repositoryHas(config(JSON.stringify({ exceptions: [{ files: [TYPED.path], reason: REASON, rules: [ANY] }], sources: ["src"] })), TYPED),
		biomeFormatted(),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("baseline", "write");
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "rejected"],
			["stale exception", () => stdout(), expect.stringContaining(`${ANY} src/parse.ts matches no finding.`)],
		]);
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality lint accepts an active Biome exception and rejects it after the finding is fixed",
	[
		repositoryHas(config(JSON.stringify({ exceptions: [{ files: [UNTYPED.path], reason: REASON, rules: [ANY] }], sources: ["src"] })), UNTYPED),
		biomeFormatted(),
	],
	function* ({ outcome, runs, stdout, writes }) {
		yield* runs("lint");
		expect(yield* outcome()).toBe("passed");

		yield* writes(TYPED);
		yield* runs("lint");

		yield* outcomes([
			["exit", () => outcome(), "rejected"],
			["repair", () => stdout(), expect.stringContaining(`${ANY} src/parse.ts matches no finding.`)],
		]);
	},
	CLI_TIMEOUT,
);

exceptionStory.it(
	"quality lint keeps an active Biome assist exception",
	[
		repositoryHas(
			config(
				JSON.stringify({
					exceptions: [{ files: ["src/Pair.ts"], reason: REASON, rules: ["biome/assist/source/useSortedInterfaceMembers"] }],
					sources: ["src"],
				}),
			),
			{ content: "export interface Pair {\n\tzebra: string;\n\talpha: string;\n}\n", path: "src/Pair.ts" },
		),
		biomeFormatted(),
	],
	function* ({ outcome, runs }) {
		yield* runs("lint");

		expect(yield* outcome()).toBe("passed");
	},
	CLI_TIMEOUT,
);

for (const rule of [ANY, "biome/assist/source/organizeImports"]) {
	exceptionStory.it(
		`quality lint rejects a stale ${rule} exception and names the file, rule and selected config to repair`,
		[
			repositoryHas(
				{
					...config(JSON.stringify({ exceptions: [{ files: [TYPED.path], reason: REASON, rules: [rule] }], sources: ["src"] })),
					path: "custom.config.ts",
				},
				TYPED,
			),
			biomeFormatted(),
		],
		function* ({ outcome, runs, stdout }) {
			yield* runs("lint", "--config", "custom.config.ts");

			yield* outcomes([
				["exit", () => outcome(), "rejected"],
				[
					"repair",
					() => stdout(),
					expect.stringContaining(`${rule} src/parse.ts matches no finding. Remove this file/rule pair from exceptions in custom.config.ts.`),
				],
			]);
		},
		CLI_TIMEOUT,
	);
}

for (const [label, files, rules, staleFile, staleRule] of [
	["file", [UNTYPED.path, "src/typed.ts"], [ANY], "src/typed.ts", ANY],
	["rule", [UNTYPED.path], [ANY, "biome/lint/correctness/noEmptyPattern"], UNTYPED.path, "biome/lint/correctness/noEmptyPattern"],
] as const) {
	exceptionStory.it(
		`quality lint rejects the stale ${label} in an exception that also suppresses a finding`,
		[
			repositoryHas(config(JSON.stringify({ exceptions: [{ files, reason: REASON, rules }], sources: ["src"] })), UNTYPED, {
				content: TYPED.content.replace("parse", "typed"),
				path: "src/typed.ts",
			}),
			biomeFormatted(),
		],
		function* ({ outcome, runs, stdout }) {
			yield* runs("lint");

			yield* outcomes([
				["exit", () => outcome(), "rejected"],
				["stale pair", () => stdout(), expect.stringContaining(`${staleRule} ${staleFile} matches no finding.`)],
			]);
		},
		CLI_TIMEOUT,
	);
}
