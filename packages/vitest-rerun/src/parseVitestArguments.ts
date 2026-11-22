import { Effect } from "effect";
import * as VitestNode from "vitest/node";
import { failWith } from "#error.ts";

export function parseVitestArguments(args: readonly string[]) {
	return Effect.try({
		catch: (cause) => failWith(`Could not parse Vitest arguments: ${cause instanceof Error ? cause.message : String(cause)}`)(cause),
		try: () => VitestNode.parseCLI(["vitest", "run", ...args]),
	});
}
