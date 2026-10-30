import { join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { fixJsxConditionals } from "#adapters/fixJsxConditionals.ts";
import { loadConfig } from "#config/load.ts";
import { scan } from "#engine/session.ts";
import { GateFailed, SetupFailure } from "#failure.ts";
import { collectInventory } from "#inventory/collect.ts";
import { plural } from "#report/plural.ts";
import type { RuleServices } from "#rule.ts";

const GROUPED =
	"Consecutive assertions stop on the first failure; outcomes evaluates row expressions up front and reads every outcome before asserting. Rewrite these stories by hand to review that change in evaluation and failure order.";

export const fixRule = Effect.fn("Cli.fixRule")(function* (
	cwd: string,
	configPath: string | undefined,
	rules: readonly string[],
): Effect.fn.Return<void, SetupFailure | GateFailed, RuleServices> {
	const config = yield* loadConfig(cwd, configPath);
	for (const rule of rules) {
		if (rule !== "react/jsx-conditionals") {
			return yield* new SetupFailure({
				message: `No safe mechanical fix for ${rule}.${rule === "tests/grouped-outcomes" ? ` ${GROUPED}` : " Repair its findings by hand."}`,
			});
		}
	}
	const fs = yield* FileSystem.FileSystem;
	const inventory = yield* collectInventory(config.root, config).pipe(
		Effect.mapError((cause) => new SetupFailure({ cause, message: cause.message })),
	);
	let changed = 0;
	for (const file of inventory.sources) {
		const text = fixJsxConditionals(file);
		if (text !== file.text) {
			yield* fs
				.writeFileString(join(config.root, file.path), text)
				.pipe(Effect.mapError((cause) => new SetupFailure({ cause, message: cause.message })));
			changed += 1;
		}
	}
	yield* Console.log(`quality: react/jsx-conditionals rewrote ${plural(changed, "file")}.`);
	const remaining = (yield* scan({ ...config, active: config.active.filter((rule) => rules.includes(rule.id)) })).violations;
	for (const finding of remaining) {
		yield* Console.log(`${finding.file}:${finding.line ?? 1} ${finding.rule}: ${finding.message}`);
	}
	if (remaining.length > 0) {
		return yield* new GateFailed();
	}
});
