import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { debtRecorded, deepSharesDropped, effectInstalled, environmentSets, lintRunStory, repositoryHas } from "#test/lintRuns.ts";
import { packageProgramFiles } from "#test/packageProgramFiles.ts";
import { FAST_RUN, FULL_RUN } from "#test/runs.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const THROWING_HELPER = [
	{ content: 'export function fail(): never {\n\tthrow new Error("failed");\n}\n', path: "packages/alpha/src/fail.ts" },
	{ content: 'import { fail } from "./fail.ts";\n\nexport const stop = () => fail();\n', path: "packages/alpha/src/stop.ts" },
	{
		content: 'function refuse(): never {\n\tthrow new Error("refused");\n}\n\nexport const guard = () => refuse();\n',
		path: "packages/alpha/src/guard.ts",
	},
	{ content: "export const settle = (work: Promise<number>) => work;\n", path: "packages/alpha/src/settle.ts" },
];

const WORKSPACE = [effectInstalled(), repositoryHas(...packageProgramFiles, ...THROWING_HELPER)];

lintRunStory.it(
	"a local lint reports the fast rules' findings, leaves out effect/service-parameters and names it in its closing line",
	WORKSPACE,
	function* ({ lastLine, lints, reportsRule }) {
		yield* lints();

		yield* outcomes([
			["context capture reported", () => reportsRule("effect/context-capture"), true],
			["service parameters reported", () => reportsRule("effect/service-parameters"), false],
			["closing line", () => lastLine(), FAST_RUN],
		]);
	},
	CLI_TIMEOUT,
);

lintRunStory.it(
	"a local lint never prepares the effect/service-parameters check or the typed casts in the package walk the fast type-checking rules share",
	WORKSPACE,
	function* ({ lints, spanCount }) {
		yield* lints();

		yield* outcomes([
			["package walks", () => spanCount("PackageChecks.walk"), 1],
			["service-parameters preparations", () => spanCount("Services.serviceParameterCheck"), 0],
			["typed cast preparations", () => spanCount("Suppressions.typedCastCheck"), 0],
		]);
	},
	CLI_TIMEOUT,
);

for (const [run, args, typed] of [
	["a local lint reports", [], false],
	["a full lint reports", ["--full"], true],
] as const) {
	lintRunStory.it(
		`${run} effect/boundary's throw statements and same-module helper calls${typed ? " and" : " but not"} its imported helper calls and Promise-typed parameters`,
		WORKSPACE,
		function* ({ lints, report }) {
			yield* lints(...args);
			function reports(message: string) {
				return Effect.map(report(), (text) => text.includes(message));
			}

			yield* outcomes([
				["throw statement", () => reports("Uses throw statement."), true],
				["same-module helper call", () => reports("Uses throwing helper call (refuse)."), true],
				["imported helper call", () => reports("Uses throwing helper call (fail)."), typed],
				["Promise-typed parameter", () => reports("Uses Promise-typed parameter (work)."), typed],
			]);
		},
		CLI_TIMEOUT,
	);
}

for (const [when, environment, args] of [
	["in CI", { "CI": "true" }, []],
	["in a Claude Code cloud session", { "CLAUDE_CODE_REMOTE": "true" }, []],
	["with --full", {}, ["--full"]],
] as const) {
	lintRunStory.it(
		`a lint ${when} reports effect/service-parameters beside the fast rules and names it as checked in its closing line`,
		[...WORKSPACE, environmentSets(environment)],
		function* ({ lastLine, lints, reportsRule }) {
			yield* lints(...args);

			yield* outcomes([
				["context capture reported", () => reportsRule("effect/context-capture"), true],
				["service parameters reported", () => reportsRule("effect/service-parameters"), true],
				["closing line", () => lastLine(), FULL_RUN],
			]);
		},
		CLI_TIMEOUT,
	);
}

lintRunStory.it(
	"--fast in CI leaves out effect/service-parameters and names it in the closing line",
	[...WORKSPACE, environmentSets({ "CI": "true" })],
	function* ({ lastLine, lints, reportsRule }) {
		yield* lints("--fast");

		yield* outcomes([
			["context capture reported", () => reportsRule("effect/context-capture"), true],
			["service parameters reported", () => reportsRule("effect/service-parameters"), false],
			["closing line", () => lastLine(), FAST_RUN],
		]);
	},
	CLI_TIMEOUT,
);

lintRunStory.it(
	"a lint with --config names that config in the command its closing line suggests",
	[...WORKSPACE, repositoryHas({ content: "export default {};", path: "tools/quality.config.ts" })],
	function* ({ lastLine, lints }) {
		yield* lints("--config", "tools/quality.config.ts");

		expect(yield* lastLine()).toContain("Run `quality lint --full --config tools/quality.config.ts` to check now.");
	},
	CLI_TIMEOUT,
);

for (const [recording, traits, line] of [
	["records", [], '{"path":"packages/alpha/src/stop.ts","rule":"effect/boundary","count":1,"deep":1}'],
	["does not yet record", [deepSharesDropped()], '{"path":"packages/alpha/src/stop.ts","rule":"effect/boundary","count":1}'],
] as const) {
	lintRunStory.it(
		`a local lint passes beside a deep rule's entries and a split rule's entry that ${recording} its deep half, reports them neither stale nor loose and leaves their shard untouched`,
		[...WORKSPACE, debtRecorded(), ...traits],
		function* ({ lints, outcome, reads, report }) {
			const recorded = yield* reads("packages/alpha/quality-baseline.jsonl");
			expect(recorded).toContain('"rule":"effect/service-parameters"');
			expect(recorded).toContain(line);

			yield* lints();

			yield* outcomes([
				["outcome", () => outcome(), "passed"],
				["report", () => report(), expect.not.stringContaining("quality-baseline.jsonl")],
				["shard", () => reads("packages/alpha/quality-baseline.jsonl"), recorded],
			]);
		},
		CLI_TIMEOUT,
	);
}

lintRunStory.it(
	"a full lint passes beside split entries that do not record their deep half and notes once how to record it",
	[...WORKSPACE, debtRecorded(), deepSharesDropped()],
	function* ({ lints, outcome, report }) {
		yield* lints("--full");

		yield* outcomes([
			["outcome", () => outcome(), "passed"],
			["note", () => report(), expect.stringContaining("not record how many findings the deep half reports (effect/boundary 5).")],
		]);
	},
	CLI_TIMEOUT,
);

const LOCAL_DEEP_RULE = {
	content: `import { defineRule } from "@shivaedev/quality/rule.ts";
const drafts = defineRule({
	check: ({ sources }) => sources.filter((file) => file.text.includes("draft")).map((file) => ({ file: file.path, message: "Replace the draft." })),
	depth: "deep",
	description: "Replace drafts before merging.",
	id: "local/drafts",
});
export default { local: [drafts] };
`,
	path: "quality.config.ts",
};

for (const [run, args, reported] of [
	["a local lint skips", [], false],
	["a full lint runs", ["--full"], true],
] as const) {
	lintRunStory.it(
		`${run} a local rule that declares depth deep`,
		[effectInstalled(), repositoryHas(LOCAL_DEEP_RULE, { content: 'export const title = "draft";\n', path: "src/title.ts" })],
		function* ({ lastLine, lints, reportsRule }) {
			yield* lints(...args);

			yield* outcomes([
				["draft reported", () => reportsRule("local/drafts"), reported],
				["closing line", () => lastLine(), expect.stringContaining("local/drafts")],
			]);
		},
		CLI_TIMEOUT,
	);
}

const LOCAL_HALVED_RULE = {
	content: `import { defineRule } from "@shivaedev/quality/rule.ts";
const notes = defineRule({
	check: ({ sources }) => sources.filter((file) => file.text.includes("draft")).map((file) => ({ file: file.path, message: "Replace the draft." })),
	deepHalf: {
		check: ({ sources }) => sources.filter((file) => file.text.includes("review")).map((file) => ({ file: file.path, message: "Finish the review." })),
		name: "reviews",
	},
	description: "Replace drafts and finish reviews before merging.",
	id: "local/notes",
});
export default { local: [notes] };
`,
	path: "quality.config.ts",
};

for (const [run, args, reviewed] of [
	["a local lint runs only the fast half", [], false],
	["a full lint runs both halves", ["--full"], true],
] as const) {
	lintRunStory.it(
		`${run} of a local rule that declares a deep half and names that half in its closing line`,
		[effectInstalled(), repositoryHas(LOCAL_HALVED_RULE, { content: 'export const title = "draft for review";\n', path: "src/title.ts" })],
		function* ({ lastLine, lints, report }) {
			yield* lints(...args);

			yield* outcomes([
				["draft reported", () => report(), expect.stringContaining("Replace the draft.")],
				["review reported", () => Effect.map(report(), (text) => text.includes("Finish the review.")), reviewed],
				["closing line", () => lastLine(), expect.stringContaining("local/notes reviews")],
			]);
		},
		CLI_TIMEOUT,
	);
}
