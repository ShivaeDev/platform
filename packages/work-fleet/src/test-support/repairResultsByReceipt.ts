import { Effect } from "effect";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function repairResultsByReceipt(controls: {
	readonly merged: () => boolean;
	readonly receipts: () => string[];
	readonly results: () => Map<
		string,
		| {
				readonly head: string;
				readonly kind: "change";
				readonly paths: readonly string[];
				readonly pr: string;
				readonly prNumber?: number | undefined;
		  }
		| { readonly evidence: readonly string[]; readonly head: string; readonly kind: "no-change" }
	>;
}) {
	return (): EngineOptions => ({
		deliveryQuery: (result) => Effect.succeed(controls.merged() ? { head: result.head, revision: "merge-commit", url: result.pr } : undefined),
		repairs: true,
		resultQuery: (_board, observation) =>
			Effect.sync(() => {
				controls.receipts().push(observation.receipt.turnId);
				const result = controls.results().get(observation.receipt.turnId) ?? {
					head: `head-${controls.results().size}`,
					kind: "change" as const,
					paths: ["src/one.ts"],
					pr: "https://example.invalid/pr/one",
				};
				controls.results().set(observation.receipt.turnId, result);
				return result;
			}),
	});
}
