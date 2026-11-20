import { Effect } from "effect";
import { parseCommand } from "#cli/args.ts";
import { runSet } from "#cli/runSet.ts";
import type { RunSet } from "#engine/session.ts";

// A full run adds the package walk and the typed halves, which hold more at once than the fast rules.
const LIMITS: Readonly<Record<RunSet, number>> = { fast: 2048, full: 3072 };

// Only a lint and the pre-commit hook's lint can run the fast set; every other command that scans runs every rule.
export const heapLimit = Effect.fn("Cli.heapLimit")(function* (args: readonly string[]) {
	const parsed = parseCommand(args);
	if (parsed._tag === "Usage") {
		return LIMITS.fast;
	}
	const { command } = parsed;
	if (command._tag === "Lint" || command._tag === "HooksPreCommit") {
		return LIMITS[yield* runSet(command._tag === "Lint" ? command.set : undefined)];
	}
	return LIMITS.full;
});

export function heapLimitReached(megabytes: number): string {
	return `quality: Node aborted the run, as it does when the run reaches its heap limit of ${megabytes} MB. Quality sets ${LIMITS.fast} MB for a fast run and ${LIMITS.full} MB for a full run; raise the limit with NODE_OPTIONS=--max-old-space-size=<megabytes>, which Quality keeps.`;
}
