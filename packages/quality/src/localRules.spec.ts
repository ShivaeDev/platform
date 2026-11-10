import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { biomeFormatted, effectInstalled, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";
import { withMatchers } from "#testing/adapters/assertThat.ts";
import { CLI_TIMEOUT } from "#testing/adapters/cli.ts";

const NO_CONSOLE_LOG = {
	content: [
		'import { defineConfig } from "@shivaedev/quality/config.ts";',
		'import { defineRule } from "@shivaedev/quality/rule.ts";',
		'const noLog = defineRule({ id: "local/no-console-log", description: "Log through the logger.",',
		'  check: ({ sources }) => sources.filter((file) => file.text.includes("console.log")).map((file) => ({ file: file.path, message: "logs to the console." })) });',
		'export default defineConfig({ local: [noLog], sources: ["src"] });',
	].join("\n"),
	path: "quality.config.ts",
};

const UNTYPED_EXPORTS = {
	content: [
		'import { Effect } from "effect";',
		'import { defineConfig } from "@shivaedev/quality/config.ts";',
		'import { defineRule } from "@shivaedev/quality/rule.ts";',
		'const typedExports = defineRule({ id: "local/typed-exports", description: "Exports carry a known type.",',
		"  check: ({ sources, typeScript }) => Effect.map(typeScript, ({ checker, sourceFile }) => sources.flatMap((file) => {",
		"    const source = sourceFile(file.path);",
		"    const module = source === undefined ? undefined : checker.getSymbolAtLocation(source);",
		"    return (module === undefined ? [] : checker.getExportsOfModule(module))",
		"      .map((exported) => ({ name: exported.name, type: checker.typeToString(checker.getTypeOfSymbol(exported)) }))",
		'      .filter(({ type }) => type === "any")',
		'      .map(({ name, type }) => ({ file: file.path, message: "exports " + name + " typed as " + type + "." }));',
		"  })) });",
		'export default defineConfig({ local: [typedExports], sources: ["src"] });',
	].join("\n"),
	path: "quality.config.ts",
};

const COUNTED_PROGRAMS = {
	content: [
		'import { Effect } from "effect";',
		'import { defineConfig } from "@shivaedev/quality/config.ts";',
		'import { defineRule } from "@shivaedev/quality/rule.ts";',
		"const programs = new Set<unknown>();",
		'const counting = (id: string) => defineRule({ id, description: "Counts the programs it has seen.",',
		"  check: ({ typeScript }) => Effect.map(typeScript, ({ program }) => {",
		"    programs.add(program);",
		'    return [{ file: "src/limit.ts", message: "has seen " + programs.size + " program." }];',
		"  }) });",
		'export default defineConfig({ local: [counting("local/first"), counting("local/second")], sources: ["src"] });',
	].join("\n"),
	path: "quality.config.ts",
};

const UNEVEN_PATHS = {
	content: [
		'import { join } from "node:path";',
		'import { defineRule } from "@shivaedev/quality/rule.ts";',
		'const uneven = defineRule({ id: "local/uneven", description: "Names files three ways.",',
		'  check: ({ root }) => [{ file: "./src/a.ts", message: "dotted" }, { file: join(root, "src/b.ts"), message: "absolute" }, { file: "src\\\\c.ts", message: "backslashed" }] });',
		"export default { local: [uneven] };",
	].join("\n"),
	path: "quality.config.ts",
};

repositoryStory.it(
	"quality lint reports a local rule from a typed config under its id and description, with the exception entry that would register the finding",
	[qualityInstalled(), repositoryHas(NO_CONSOLE_LOG, { content: 'console.log("ready");\n', path: "src/log.ts" }), biomeFormatted()],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				[
					"report",
					() => stdout(),
					expect.stringContaining(
						'error local/no-console-log (1)\n  Log through the logger.\n  src/log.ts  logs to the console. For a permanent exception, add to exceptions in quality.config.ts: {"files":["src/log.ts"],"reason":"Explain why this exception is permanent.","rules":["local/no-console-log"]}.',
					),
				],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint names the file of each local finding relative to the repository root, whether the rule gave it dotted, absolute or with backslashes",
	[qualityInstalled(), repositoryHas(UNEVEN_PATHS), biomeFormatted()],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["absolute", () => stdout(), expect.stringContaining("  src/b.ts  absolute")],
				["backslashed", () => stdout(), expect.stringContaining("  src/c.ts  backslashed")],
				["dotted", () => stdout(), expect.stringContaining("  src/a.ts  dotted")],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint runs a local rule that reads exported types from the shared TypeScript program and reports only the export typed as any",
	[
		qualityInstalled(),
		effectInstalled(),
		repositoryHas(
			UNTYPED_EXPORTS,
			{ content: 'export const limit = JSON.parse("3");\n', path: "src/limit.ts" },
			{ content: 'export const name = "ready";\n', path: "src/name.ts" },
		),
		biomeFormatted(),
	],
	function* ({ outcome, runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				["exit", () => outcome(), "rejected"],
				[
					"untyped export",
					() => stdout(),
					expect.stringContaining("error local/typed-exports (1)\n  Exports carry a known type.\n  src/limit.ts  exports limit typed as any."),
				],
			]),
		);
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint hands every local rule that asks for the TypeScript program the same one",
	[
		qualityInstalled(),
		effectInstalled(),
		repositoryHas(COUNTED_PROGRAMS, { content: "export const limit = 3;\n", path: "src/limit.ts" }),
		biomeFormatted(),
	],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		yield* withMatchers((expect) =>
			outcomes([
				[
					"first rule",
					() => stdout(),
					expect.stringContaining("error local/first (1)\n  Counts the programs it has seen.\n  src/limit.ts  has seen 1 program."),
				],
				[
					"second rule",
					() => stdout(),
					expect.stringContaining("error local/second (1)\n  Counts the programs it has seen.\n  src/limit.ts  has seen 1 program."),
				],
			]),
		);
	},
	CLI_TIMEOUT,
);
