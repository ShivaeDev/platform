import { Effect, Schema } from "effect";
import { FlakyTests } from "#flakyTests.ts";
import { RAN } from "./specFiles.ts";
import { lastRun, listFiles, REPORTS, readFile, type Suite } from "./suite.ts";

export interface Testcase {
	readonly classname: string;
	readonly file: string | undefined;
	readonly name: string;
	readonly result: "failed" | "passed" | "skipped";
}

const JsonReport = Schema.Struct({
	testResults: Schema.Array(
		Schema.Struct({
			assertionResults: Schema.Array(
				Schema.Struct({
					ancestorTitles: Schema.Array(Schema.String),
					duration: Schema.optional(Schema.NullOr(Schema.Number)),
					status: Schema.String,
					title: Schema.String,
				}),
			),
			durationMs: Schema.optional(Schema.Number),
			name: Schema.String,
		}),
	),
});
type JsonReport = typeof JsonReport.Type;
const decodeJsonReport = Schema.decodeUnknownSync(Schema.fromJsonString(JsonReport));

const TESTCASE = /<testcase (?<attributes>[^>]*?)(?<selfClosing>\/?)>(?<body>[\s\S]*?)(?:<\/testcase>|(?=<testcase )|(?=<\/testsuite>))/gu;
const ATTRIBUTE = /(?<key>\w+)="(?<value>[^"]*)"/gu;
const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&apos;": "'", "&gt;": ">", "&lt;": "<", "&quot;": '"' };
const RESULT_ELEMENTS = { failed: "failure", skipped: "skipped" } as const;
const REPORT_FILE = /^[^/]+\.(?:bin|json|xml)$/u;
const COVERED_FUNCTION = /^FNDA:(?<count>\d+),(?<name>\w+)$/gmu;
const RESULTS_CACHE = /^(?<cache>.+)\/vitest\/\w+\/results\.json$/u;

function byText(left: string, right: string): number {
	return left.localeCompare(right);
}

function unescapeXml(value: string): string {
	return value.replace(/&(?:amp|apos|gt|lt|quot);/gu, (entity) => ENTITIES[entity] ?? entity);
}

function testName({ ancestorTitles, title }: JsonReport["testResults"][number]["assertionResults"][number]): string {
	return [...ancestorTitles, title].join(" > ");
}

function testcases(xml: string): readonly Testcase[] {
	const found = [...xml.matchAll(TESTCASE)].map((match): Testcase => {
		const attributes = Object.fromEntries(
			[...(match.groups?.attributes ?? "").matchAll(ATTRIBUTE)].map((attribute) => [
				attribute.groups?.key,
				unescapeXml(attribute.groups?.value ?? ""),
			]),
		);
		const body = match.groups?.selfClosing === "" ? (match.groups?.body ?? "") : "";
		const result = (["failed", "skipped"] as const).find((outcome) => body.includes(`<${RESULT_ELEMENTS[outcome]}`)) ?? "passed";
		return { classname: attributes.classname ?? "", file: attributes.file, name: attributes.name ?? "", result };
	});
	return found.toSorted((left, right) => byText(`${left.classname} ${left.name}`, `${right.classname} ${right.name}`));
}

export function reportReadouts(suite: Suite) {
	function reportText(name: string): string {
		const contents = readFile(suite, `${REPORTS}/${name}`);
		if (contents === undefined) {
			throw new Error(`vitest-rerun wrote no ${name}`);
		}
		return contents;
	}
	function json(name: string): JsonReport {
		return decodeJsonReport(reportText(name));
	}
	function durations(entry: string, durationIn: (written: JsonReport) => number | undefined) {
		function from(name: string): number {
			const duration = durationIn(json(name));
			if (duration === undefined) {
				throw new Error(`${name} records no duration for ${entry}`);
			}
			return duration;
		}
		return Effect.sync(() => ({ final: from("tests.json"), firstAttempt: from("tests.attempt-1.json"), rerun: from("tests.attempt-2.json") }));
	}
	return {
		coveredFunctions: () =>
			Effect.sync(() =>
				[...(readFile(suite, "coverage/lcov.info") ?? "").matchAll(COVERED_FUNCTION)]
					.flatMap((match) => (Number(match.groups?.count) > 0 ? (match.groups?.name ?? []) : []))
					.toSorted(byText),
			),
		exitCode: () => Effect.sync(() => lastRun(suite).exitCode),
		fileDurations: (file: string) => durations(file, (written) => written.testResults.find((result) => result.name.endsWith(`/${file}`))?.durationMs),
		flakyTests: () =>
			Effect.sync(() => {
				const contents = readFile(suite, `${REPORTS}/flaky-tests.json`);
				return contents === undefined ? "not written" : Schema.decodeUnknownSync(Schema.fromJsonString(FlakyTests))(contents);
			}),
		jsonResults: (name = "tests.json") =>
			Effect.sync(() =>
				Object.fromEntries(json(name).testResults.flatMap((file) => file.assertionResults.map((test) => [testName(test), test.status]))),
			),
		junitResults: (name = "tests.junit.xml") => Effect.sync(() => testcases(reportText(name))),
		printedError: () => Effect.sync(() => /^vitest-rerun: (?<message>.+)$/mu.exec(lastRun(suite).output)?.groups?.message ?? "nothing"),
		reports: () => Effect.sync(() => listFiles(suite, REPORTS).filter((path) => REPORT_FILE.test(path))),
		resultsCaches: () =>
			Effect.sync(() =>
				listFiles(suite)
					.flatMap((path) => RESULTS_CACHE.exec(path)?.groups?.cache ?? [])
					.toSorted(byText),
			),
		summary: () => Effect.sync(() => (readFile(suite, "summary.md") ?? "").split("\n").filter((line) => line !== "")),
		testDurations: (test: string) =>
			durations(
				test,
				(written) =>
					written.testResults.flatMap((result) => result.assertionResults).find((result) => testName(result) === test)?.duration ?? undefined,
			),
		timesRan: () =>
			Effect.sync(() => {
				const counts: Record<string, number> = {};
				for (const name of (readFile(suite, RAN) ?? "").split("\n").filter((line) => line !== "")) {
					counts[name] = (counts[name] ?? 0) + 1;
				}
				return counts;
			}),
	};
}
