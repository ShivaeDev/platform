import * as NodePath from "@effect/platform-node/NodePath";
import { Console, Effect, FileSystem, Path } from "effect";
import { fixJsxConditionals } from "#adapters/fixJsxConditionals.ts";
import { fixAscii } from "#cli/fixAscii.ts";
import { loadConfig } from "#config/load.ts";
import { scan } from "#engine/session.ts";
import { GateFailed, SetupFailure } from "#failure.ts";
import { collectInventory } from "#inventory/collect.ts";
import { plural } from "#report/plural.ts";
import type { RuleServices, SourceFile } from "#rule.ts";

const GROUPED =
	"Consecutive assertions stop on the first failure; outcomes constructs rows eagerly, then lazily invokes each readout callback in row order before the grouped assertion. Rewrite these stories by hand to review that change in evaluation and failure order.";

const rewriteJsx = Effect.fn("Cli.rewriteJsx")(function* (root: string, files: readonly SourceFile[]) {
	const { join } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));
	const fs = yield* FileSystem.FileSystem;
	let changed = 0;
	for (const file of files) {
		const text = fixJsxConditionals(file);
		if (text !== file.text) {
			yield* fs.writeFileString(join(root, file.path), text).pipe(Effect.mapError((cause) => new SetupFailure({ cause, message: cause.message })));
			changed += 1;
		}
	}
	yield* Console.log(`quality: react/jsx-conditionals rewrote ${plural(changed, "file")}.`);
});

export const fixRule = Effect.fn("Cli.fixRule")(function* (
	cwd: string,
	configPath: string | undefined,
	rules: readonly string[],
): Effect.fn.Return<void, SetupFailure | GateFailed, RuleServices> {
	const config = yield* loadConfig(cwd, configPath);
	const unsupported = rules.find((rule) => rule !== "react/jsx-conditionals" && rule !== "files/ascii");
	if (unsupported !== undefined) {
		return yield* new SetupFailure({
			message: `No safe mechanical fix for ${unsupported}.${unsupported === "tests/grouped-outcomes" ? ` ${GROUPED}` : " Repair its findings by hand."}`,
		});
	}
	const inventory = yield* collectInventory(config.root, config).pipe(
		Effect.mapError((cause) => new SetupFailure({ cause, message: cause.message })),
	);
	if (rules.includes("react/jsx-conditionals")) {
		yield* rewriteJsx(config.root, inventory.sources);
	}
	if (rules.includes("files/ascii")) {
		yield* fixAscii(config);
	}
	const remaining = (yield* scan({ ...config, active: config.active.filter((rule) => rules.includes(rule.id)) })).violations;
	for (const finding of remaining) {
		yield* Console.log(`${finding.file}:${finding.line ?? 1} ${finding.rule}: ${finding.message}`);
	}
	if (remaining.length > 0) {
		return yield* new GateFailed();
	}
});
