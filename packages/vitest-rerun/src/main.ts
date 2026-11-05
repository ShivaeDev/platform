import { Console, Effect } from "effect";
import { parseOptions } from "#options.ts";
import { rerun } from "#rerun.ts";

export function main(args: readonly string[], cwd: string) {
	return parseOptions(args, cwd).pipe(
		Effect.flatMap(rerun),
		Effect.catchTag("VitestRerunError", (error) => Effect.as(Console.error(`vitest-rerun: ${error.message}`), 2)),
	);
}
