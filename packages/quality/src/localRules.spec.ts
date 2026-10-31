import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CLI_TIMEOUT } from "#test/cli.ts";
import { biomeFormatted, qualityInstalled, repositoryHas, repositoryStory } from "#test/repositoryStory.ts";

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

		yield* outcomes({
			"exit": [outcome(), "rejected"],
			"report": [
				stdout(),
				expect.stringContaining(
					'error local/no-console-log (1)\n  Log through the logger.\n  src/log.ts  logs to the console. For a permanent exception, add to exceptions in quality.config.ts: {"files":["src/log.ts"],"reason":"Explain why this exception is permanent.","rules":["local/no-console-log"]}.',
				),
			],
		});
	},
	CLI_TIMEOUT,
);

repositoryStory.it(
	"quality lint names the file of each local finding relative to the repository root, whether the rule gave it dotted, absolute or with backslashes",
	[qualityInstalled(), repositoryHas(UNEVEN_PATHS), biomeFormatted()],
	function* ({ runs, stdout }) {
		yield* runs("lint");

		yield* outcomes({
			"absolute": [stdout(), expect.stringContaining("  src/b.ts  absolute")],
			"backslashed": [stdout(), expect.stringContaining("  src/c.ts  backslashed")],
			"dotted": [stdout(), expect.stringContaining("  src/a.ts  dotted")],
		});
	},
	CLI_TIMEOUT,
);
