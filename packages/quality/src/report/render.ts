import type { Regression } from "#baseline/compare.ts";
import { type Outcome, passes } from "#engine/evaluate.ts";
import { groupBy, keyOf, type Violation } from "#engine/violation.ts";
import { plural } from "./plural.ts";
import { staleSections } from "./stale.ts";

export type WarningDetail = "summary" | "all";

export interface ReportContext {
	readonly baseline: string;
	readonly checked: number;
	readonly descriptions: ReadonlyMap<string, string>;
	readonly registry: string;
	readonly warnings: WarningDetail;
}

const LISTED_FILES = 5;

const locate = (violation: Violation): string => (violation.line === undefined ? violation.file : `${violation.file}:${violation.line}`);

const regressionNote = (regression: Regression): string =>
	`  ${regression.entry.file} is over its baseline: ${regression.count} against ${regression.entry.count} baselined.`;

const heading = (label: string, rule: string, violations: readonly Violation[], context: ReportContext): readonly string[] => {
	const description = context.descriptions.get(rule);
	return [`${label} ${rule} (${violations.length})`, ...(description === undefined ? [] : [`  ${description}`])];
};

const detailed = (violations: readonly Violation[], regressions: ReadonlyMap<string, Regression>): readonly string[] =>
	[...groupBy(violations, (violation) => violation.file).values()].flatMap((inFile) => {
		const first = inFile[0];
		const regression = first === undefined ? undefined : regressions.get(keyOf(first.rule, first.file));
		return [
			...inFile.map((violation) => `  ${locate(violation)}  ${violation.message}`),
			...(regression === undefined ? [] : [regressionNote(regression)]),
		];
	});

const summarized = (violations: readonly Violation[]): readonly string[] => {
	const files = [...groupBy(violations, (violation) => violation.file).entries()].sort(([, left], [, right]) => right.length - left.length);
	const listed = files.slice(0, LISTED_FILES).map(([file, inFile]) => `${file} (${inFile.length})`);
	const rest = files.length - listed.length;
	return [`  ${listed.join(", ")}${rest > 0 ? `, and ${plural(rest, "more file", "more files")}` : ""}. --warnings all lists each one.`];
};

const ruleSections = (
	label: string,
	violations: readonly Violation[],
	context: ReportContext,
	body: (inRule: readonly Violation[]) => readonly string[],
): readonly string[] =>
	[...groupBy(violations, (violation) => violation.rule).entries()].map(([rule, inRule]) =>
		[...heading(label, rule, inRule, context), ...body(inRule)].join("\n"),
	);

const failures = (outcome: Outcome): string => {
	const stale = outcome.staleBaseline.length + outcome.staleRegistry.length;
	return [
		...(outcome.errors.length > 0 ? [plural(outcome.errors.length, "error")] : []),
		...(stale > 0 ? [plural(stale, "stale entry", "stale entries")] : []),
	].join(" and ");
};

const summary = (outcome: Outcome, context: ReportContext): string => {
	const verdict = passes(outcome) ? "quality: passed" : `quality: failed with ${failures(outcome)}`;
	const warnings = outcome.warnings.length > 0 ? `; ${plural(outcome.warnings.length, "warning")} from rules still at warn` : "";
	const hidden = [
		...(outcome.baselined > 0 ? [`${outcome.baselined} baselined`] : []),
		...(outcome.registered > 0 ? [`${outcome.registered} registered`] : []),
	];
	const suppressed =
		hidden.length === 0 ? "" : `; ${hidden.join(" and ")} ${outcome.baselined + outcome.registered === 1 ? "violation" : "violations"} not shown`;
	return `${verdict}${warnings}. ${plural(context.checked, "source file")} checked${suppressed}.`;
};

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

export const render = (outcome: Outcome, context: ReportContext): string => {
	const regressions = new Map(outcome.regressions.map((regression) => [keyOf(regression.entry.rule, regression.entry.file), regression]));
	const warningBody = context.warnings === "all" ? (inRule: readonly Violation[]) => detailed(inRule, regressions) : summarized;
	return [
		...ruleSections("error", outcome.errors, context, (inRule) => detailed(inRule, regressions)),
		...ruleSections("warn", outcome.warnings, context, warningBody),
		...staleSections(outcome, context),
		summary(outcome, context),
		...rerecord(outcome),
	].join("\n\n");
};
