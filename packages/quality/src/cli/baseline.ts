import { relative, resolve } from "node:path";
import { Console, Effect, type FileSystem } from "effect";
import type { BaselineEntry } from "#baseline/format.ts";
import { saveShards } from "#baseline/shards.ts";
import { adopt, type Pruned, prune, type Scope } from "#baseline/update.ts";
import { openSession, type Session } from "#engine/session.ts";
import { registrable } from "#engine/violation.ts";
import { applyRegistry } from "#exceptions/registry.ts";
import { SetupFailure } from "#failure.ts";
import { changesSince } from "#git/history.ts";
import { plural } from "#report/plural.ts";
import type { RuleServices } from "#rule.ts";

function save(session: Session, entries: readonly BaselineEntry[]): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> {
	return saveShards(session.config, session.baseline.files, entries);
}

function unregistered(session: Session) {
	return applyRegistry(session.violations, session.registry, session.config).kept;
}

export const writeBaseline = Effect.fn("Cli.writeBaseline")(function* (
	cwd: string,
	config: string | undefined,
	rules: readonly string[],
	files: readonly string[],
	firstAdoption = false,
): Effect.fn.Return<void, SetupFailure, RuleServices> {
	const session = yield* openSession(cwd, config);
	const existing = session.baseline.files.size === 0 ? undefined : session.baseline.entries;
	if (firstAdoption && (rules.length === 0 || rules.some((rule) => registrable(session.config, rule)))) {
		return yield* new SetupFailure({
			message: "baseline write refused: --first-adoption requires explicit --rule ids that refuse config exceptions.",
		});
	}
	if (existing !== undefined && files.length === 0 && !firstAdoption) {
		return yield* new SetupFailure({
			message: "baseline write refused: a baseline exists. Record a rule with --rule <id> and --file <path>; use prune for moved or fixed debt.",
		});
	}
	const selected = files.length === 0 ? undefined : new Set(files.map((file) => relative(session.config.root, resolve(session.config.root, file))));
	if (selected !== undefined && !firstAdoption) {
		const changed = yield* changesSince(session.config.root, ["HEAD"]);
		const outside = [...selected].filter((file) => !changed.files.has(file));
		if (outside.length > 0) {
			return yield* new SetupFailure({
				message: `baseline write refused: outside the current change set: ${outside.join(", ")}. Stage new files with git add first.`,
			});
		}
	}
	const adoption = adopt(existing, rules, unregistered(session), session.config, selected);
	if (adoption._tag === "Refused") {
		return yield* new SetupFailure({ message: `baseline write refused:\n${adoption.reasons.map((reason) => `  - ${reason}`).join("\n")}` });
	}
	if (adoption.added === 0 && adoption.replaced === 0) {
		return yield* Console.log(`quality: no error-level violations to record; ${session.config.baseline} is unchanged.`);
	}
	yield* save(session, adoption.entries);
	const replaced = adoption.replaced > 0 ? `, replacing ${plural(adoption.replaced, "entry", "entries")}` : "";
	yield* Console.log(`quality: recorded ${plural(adoption.added, "entry", "entries")} in ${session.config.baseline}${replaced}.`);
});

function changes(pruned: Pruned): string {
	const parts = [
		`removed ${plural(pruned.removed, "entry", "entries")}`,
		`lowered ${plural(pruned.lowered, "entry", "entries")}`,
		...(pruned.moved > 0 ? [`carried ${plural(pruned.moved, "entry", "entries")} to moved files`] : []),
	];
	return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

export const shrinkBaseline = Effect.fn("Cli.shrinkBaseline")(function* <TRequirements>(
	cwd: string,
	config: string | undefined,
	scopeOf: (session: Session) => Effect.Effect<Scope, SetupFailure, TRequirements>,
): Effect.fn.Return<void, SetupFailure, RuleServices | TRequirements> {
	const session = yield* openSession(cwd, config);
	if (session.baseline.files.size === 0) {
		return yield* Console.log(`quality: no baseline at ${session.config.baseline}; nothing to lower.`);
	}
	const pruned = prune(session.baseline.entries, unregistered(session), session.config, yield* scopeOf(session));
	const emptyShard = [...session.baseline.files.values()].some((file) => file.entries.length === 0);
	if (pruned.removed === 0 && pruned.lowered === 0 && pruned.moved === 0 && !emptyShard) {
		return yield* Console.log(`quality: ${session.config.baseline} is current.`);
	}
	yield* save(session, pruned.entries);
	yield* Console.log(`quality: ${changes(pruned)} in ${session.config.baseline}.`);
});
