import { join, relative } from "node:path";
import { Effect } from "effect";
import { readRequiredText } from "#inventory/filesystem.ts";
import { posix } from "#inventory/ignoreScope.ts";
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
	check: ({ root }) =>
		Effect.gen(function* () {
			const paths = yield* walk(root);
			const configs = paths.map((path) => posix(relative(root, path))).filter((path) => path.endsWith(".json"));
			const findings = yield* Effect.forEach(configs.toSorted(), (path) =>
				Effect.map(readRequiredText(join(root, path)), (text) => (text.includes(OPTION) ? settingIn(path, text) : [])),
			);
			return findings.flat();
		}),
	description:
		"ignoreDeprecations in a tsconfig silences TypeScript's errors for deprecated options, so the project keeps an option the next TypeScript removes. Replace the deprecated option and remove ignoreDeprecations.",
	id: "suppressions/no-ignore-deprecations",
	registrable: false,
});
