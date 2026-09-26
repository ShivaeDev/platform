import { describeEntry, describeTally, type Regression } from "../baseline/compare.ts";
import { type Outcome, passes } from "../engine/evaluate.ts";
import { groupBy, keyOf, type Violation } from "../engine/violation.ts";
import { plural } from "./plural.ts";
import { staleSections } from "./stale.ts";

export type WarningDetail = "summary" | "all";

export interface ReportContext {
	readonly descriptions: ReadonlyMap<string, string>;
	readonly registry: string;
	readonly baseline: string;
	readonly checked: number;
	readonly warnings: WarningDetail;
}

const LISTED_FILES = 5;

const locate = (violation: Violation): string => (violation.line === undefined ? violation.file : `${violation.file}:${violation.line}`);

const regressionNote = (regression: Regression): string =>
	`  ${regression.entry.file} is over its baseline: ${describeTally(regression.tally)} against ${describeEntry(regression.entry)} baselined.`;

const heading = (label: string, rule: string, violations: ReadonlyArray<Violation>, context: ReportContext): ReadonlyArray<string> => {
	const description = context.descriptions.get(rule);
	return [`${label} ${rule} (${violations.length})`, ...(description === undefined ? [] : [`  ${description}`])];
};

const detailed = (violations: ReadonlyArray<Violation>, regressions: ReadonlyMap<string, Regression>): ReadonlyArray<string> =>
	[...groupBy(violations, (violation) => violation.file).values()].flatMap((inFile) => {
		const first = inFile[0];
		const regression = first === undefined ? undefined : regressions.get(keyOf(first.rule, first.file));
		return [
			...inFile.map((violation) => `  ${locate(violation)}  ${violation.message}`),
			...(regression === undefined ? [] : [regressionNote(regression)]),
		];
	});

const summarized = (violations: ReadonlyArray<Violation>): ReadonlyArray<string> => {
	const files = [...groupBy(violations, (violation) => violation.file).entries()].sort(([, left], [, right]) => right.length - left.length);
	const listed = files.slice(0, LISTED_FILES).map(([file, inFile]) => `${file} (${inFile.length})`);
	const rest = files.length - listed.length;
	return [`  ${listed.join(", ")}${rest > 0 ? `, and ${plural(rest, "more file", "more files")}` : ""}. --warnings all lists each one.`];
};

const ruleSections = (
	label: string,
	violations: ReadonlyArray<Violation>,
	context: ReportContext,
	body: (inRule: ReadonlyArray<Violation>) => ReadonlyArray<string>,
): ReadonlyArray<string> =>
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

export const render = (outcome: Outcome, context: ReportContext): string => {
	const regressions = new Map(outcome.regressions.map((regression) => [keyOf(regression.entry.rule, regression.entry.file), regression]));
	const warningBody = context.warnings === "all" ? (inRule: ReadonlyArray<Violation>) => detailed(inRule, regressions) : summarized;
	return [
		...ruleSections("error", outcome.errors, context, (inRule) => detailed(inRule, regressions)),
		...ruleSections("warn", outcome.warnings, context, warningBody),
		...staleSections(outcome, context),
		summary(outcome, context),
	].join("\n\n");
};
