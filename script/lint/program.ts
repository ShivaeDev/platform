import { Effect } from "effect";
import type { Inventory } from "#lint/inventory.ts";
import { browserSafeViolations } from "#lint/rules/browser-safe.ts";
import { catalogViolations } from "#lint/rules/catalog.ts";
import { codecovViolations } from "#lint/rules/codecovViolations.ts";
import { manifestViolations } from "#lint/rules/manifests.ts";
import { nestingViolations } from "#lint/rules/nesting.ts";
import { structureViolations } from "#lint/rules/structure.ts";
import type { Violation } from "#lint/violation.ts";

const rules: ReadonlyArray<(inventory: Inventory) => readonly Violation[]> = [
	browserSafeViolations,
	catalogViolations,
	codecovViolations,
	manifestViolations,
	nestingViolations,
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
