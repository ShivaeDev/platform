import type { Regression } from "#baseline/compare.ts";
import { type Outcome, passes } from "#engine/evaluate.ts";
import { groupBy, keyOf, type Violation } from "#engine/violation.ts";
import { plural } from "./plural.ts";
import { staleSections } from "./stale.ts";

export interface ReportContext {
	readonly baseline: string;
	readonly checked: number;
	readonly descriptions: ReadonlyMap<string, string>;
	readonly registry: string;
}

function locate(violation: Violation): string {
	return violation.line === undefined ? violation.file : `${violation.file}:${violation.line}`;
}

function regressionNote(regression: Regression): string {
	return `  ${regression.entry.file} is over its baseline: ${regression.count} against ${regression.entry.count} baselined.`;
}

function heading(rule: string, violations: readonly Violation[], context: ReportContext): readonly string[] {
	const description = context.descriptions.get(rule);
	return [`error ${rule} (${violations.length})`, ...(description === undefined ? [] : [`  ${description}`])];
}

function detailed(violations: readonly Violation[], regressions: ReadonlyMap<string, Regression>): readonly string[] {
	return [...groupBy(violations, (violation) => violation.file).values()].flatMap((inFile) => {
		const first = inFile[0];
		const regression = first === undefined ? undefined : regressions.get(keyOf(first.rule, first.file));
		return [
			...inFile.map((violation) => `  ${locate(violation)}  ${violation.message}`),
			...(regression === undefined ? [] : [regressionNote(regression)]),
		];
	});
}

function ruleSections(violations: readonly Violation[], context: ReportContext, regressions: ReadonlyMap<string, Regression>): readonly string[] {
	return [...groupBy(violations, (violation) => violation.rule).entries()].map(([rule, inRule]) =>
		[...heading(rule, inRule, context), ...detailed(inRule, regressions)].join("\n"),
	);
}

function failures(outcome: Outcome): string {
	const stale = outcome.staleBaseline.length + outcome.staleRegistry.length;
	return [
		...(outcome.errors.length > 0 ? [plural(outcome.errors.length, "error")] : []),
		...(stale > 0 ? [plural(stale, "stale entry", "stale entries")] : []),
	].join(" and ");
}

function summary(outcome: Outcome, context: ReportContext): string {
	const verdict = passes(outcome) ? "quality: passed" : `quality: failed with ${failures(outcome)}`;
	const hidden = [
		...(outcome.baselined > 0 ? [`${outcome.baselined} baselined`] : []),
		...(outcome.registered > 0 ? [`${outcome.registered} registered`] : []),
	];
	const suppressed =
		hidden.length === 0 ? "" : `; ${hidden.join(" and ")} ${outcome.baselined + outcome.registered === 1 ? "violation" : "violations"} not shown`;
	return `${verdict}. ${plural(context.checked, "source file")} checked${suppressed}.`;
}

function rerecord(outcome: Outcome): readonly string[] {
	const rules = [...new Set(outcome.errors.map((violation) => violation.rule))].sort((left, right) => left.localeCompare(right));
	if (rules.length === 0) {
		return [];
	}
	const command = ["quality baseline write", ...rules.map((rule) => `--rule ${rule}`)].join(" ");
	return [
		`If the baseline should keep these findings, such as the debt of a moved or renamed file, record them again with \`${command}\` and call out the baseline growth in the pull request description.`,
	];
}

export function render(outcome: Outcome, context: ReportContext): string {
	const regressions = new Map(outcome.regressions.map((regression) => [keyOf(regression.entry.rule, regression.entry.file), regression]));
	return [
		...ruleSections(outcome.errors, context, regressions),
		...staleSections(outcome, context),
		summary(outcome, context),
		...rerecord(outcome),
	].join("\n\n");
}
