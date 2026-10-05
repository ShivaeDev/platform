import { relative } from "node:path";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { Effect } from "effect";
import { posix } from "#inventory/ignore-scope.ts";
import { walk } from "#inventory/walk.ts";
import { defineRule, type Finding } from "#rule.ts";
import { member, parseJsonc } from "#rules/suppressions/biome/json.ts";

const OPTION = "ignoreDeprecations";

const MESSAGE = `Sets "${OPTION}", which silences TypeScript's errors for deprecated options. Remove it and replace the deprecated option it hides.`;

function settingIn(path: string, text: string): readonly Finding[] {
	const parsed = parseJsonc(path, text);
	const setting = parsed._tag === "Parsed" ? member(member(parsed.json, "compilerOptions"), OPTION) : undefined;
	return setting === undefined ? [] : [{ file: path, line: setting.line, message: MESSAGE, subject: OPTION }];
}

export const noIgnoreDeprecations = defineRule({
	check: async ({ readText, root }) => {
		const paths = await Effect.runPromise(walk(root).pipe(Effect.provide(NodeFileSystem.layer)));
		const configs = paths.map((path) => posix(relative(root, path))).filter((path) => path.endsWith(".json"));
		const texts = await Promise.all(configs.toSorted().map(async (path) => ({ path, text: (await readText(path)) ?? "" })));
		return texts.filter(({ text }) => text.includes(OPTION)).flatMap(({ path, text }) => settingIn(path, text));
	},
	description:
		"ignoreDeprecations in a tsconfig silences TypeScript's errors for deprecated options, so the project keeps an option the next TypeScript removes. Replace the deprecated option and remove ignoreDeprecations.",
	id: "suppressions/no-ignore-deprecations",
	registrable: false,
});
