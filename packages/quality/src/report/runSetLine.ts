import type { RunSet } from "#engine/session.ts";
import { plural } from "#report/plural.ts";

export function runSetLine(set: RunSet, deep: readonly string[], configPath: string | undefined): readonly string[] {
	if (deep.length === 0) {
		return [];
	}
	const rules = `${plural(deep.length, "deep rule")} (${deep.toSorted((left, right) => left.localeCompare(right)).join(", ")})`;
	if (set === "full") {
		return [`quality: full run checked ${rules}.`];
	}
	const selection = configPath === undefined ? "" : ` --config ${configPath}`;
	return [`quality: fast run skipped ${rules}; CI runs ${deep.length === 1 ? "it" : "them"}. Run \`quality lint --full${selection}\` to check now.`];
}
