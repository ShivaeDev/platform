import { join } from "node:path";
import { Effect } from "effect";
import { readTemplate } from "./generation.ts";
import { checkedProcess } from "./runProcess.ts";

export const historicalTemplate = Effect.fn("CreateApp.historicalTemplate")(function* (directory: string, version: string) {
	const archive = (yield* checkedProcess(directory, "npm", [
		"pack",
		`@shivaedev/create-app@${version}`,
		"--ignore-scripts",
		"--loglevel=error",
		"--pack-destination",
		directory,
	])).trim();
	yield* checkedProcess(directory, "tar", ["-xzf", join(directory, archive), "-C", directory]);
	return yield* readTemplate(join(directory, "package/template.json"));
});
