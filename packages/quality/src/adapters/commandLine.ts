import { parseArgs } from "node:util";
import { Result } from "effect";
import { OPTIONS } from "#cli/misplaced.ts";

export function commandLine(args: readonly string[]) {
	return Result.try({
		catch: (error) => (error instanceof Error ? error.message : String(error)),
		try: () => parseArgs({ allowPositionals: true, args: [...args], options: OPTIONS, strict: true }),
	});
}
