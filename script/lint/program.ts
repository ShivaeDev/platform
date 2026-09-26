import { Effect } from "effect";
import type { Inventory } from "#lint/inventory.ts";
import { biomeOverrideViolations } from "#lint/rules/biome-overrides.ts";
import { browserSafeViolations } from "#lint/rules/browser-safe.ts";
import { commentViolations } from "#lint/rules/comments.ts";
import { manifestViolations } from "#lint/rules/manifests.ts";
import { nestingViolations } from "#lint/rules/nesting.ts";
import { pragmaViolations } from "#lint/rules/pragmas.ts";
import { structureViolations } from "#lint/rules/structure.ts";
import type { Violation } from "#lint/violation.ts";

const rules: ReadonlyArray<(inventory: Inventory) => readonly Violation[]> = [
	biomeOverrideViolations,
	browserSafeViolations,
	commentViolations,
	manifestViolations,
	nestingViolations,
	pragmaViolations,
	structureViolations,
];

export const lint = (inventory: Inventory): Effect.Effect<readonly Violation[]> =>
	Effect.map(
		Effect.all(
			rules.map((rule) => Effect.sync(() => rule(inventory))),
			{ concurrency: "unbounded" },
		),
		(results) => results.flat(),
	);
