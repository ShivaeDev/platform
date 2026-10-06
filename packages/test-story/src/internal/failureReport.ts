import { relative } from "node:path";
import { locate } from "#internal/callSite.ts";
import { engineSnapshot } from "#internal/engineSnapshot.ts";
import type { Narration, Subject } from "#internal/narration.ts";
import { describeValue } from "#internal/render.ts";
import { WIDTH, wrap } from "#internal/wrap.ts";

export interface FailedTest {
	readonly file: string;
	readonly name: string;
	readonly stack: string | undefined;
}

export function failureReport<TEngine>(narration: Narration, subject: Subject<TEngine>, test: FailedTest): string {
	try {
		return [...guide(subject.name), "", ...storyRows(narration, test), "", ...engineSnapshot(subject, test), "", rerun(test)].join("\n");
	} catch (error) {
		return `test-story could not print the story of this ${subject.name}: ${describeValue(error)}`;
	}
}

function guide(name: string): string[] {
	return [
		"╭─ test-story: how to read the story below",
		...wrap(
			`"given" lines are the test's traits, the other lines were told by verbs and engine steps as they ran, and ✗ marks where the test stopped. The traits, verbs and steps live in the ${name} story kit that this test imports.`,
			{ first: "│ ", rest: "│ " },
		),
		"╰─",
	];
}

function storyRows(narration: Narration, test: FailedTest): string[] {
	const rows = narration.lines.map(
		(line, index) => `${narration.refused?.index === index ? "✗" : " "} ${index < narration.given ? "given" : "     "}  ${line}`,
	);
	if (narration.refused !== undefined) {
		const where = locate(narration.sites[narration.refused.index]?.stack, test.file);
		rows.splice(narration.refused.index + 1, 0, ...(where === undefined ? [] : [`         refused at ${where}`]));
		return rows;
	}
	const where = locate(test.stack, test.file) ?? locate(narration.at?.stack, test.file);
	return [
		...rows,
		`✗        the test failed ${rows.length === 0 ? "before the story told a line" : "after the line above"}`,
		...(where === undefined ? [] : [`         at ${where}`]),
	];
}

function rerun(test: FailedTest): string {
	const run = `Rerun: vitest run ${relative(process.cwd(), test.file)}`;
	const filter = `-t "${test.name.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&")}"`;
	return run.length + 1 + filter.length > WIDTH ? `${run} \\\n  ${filter}` : `${run} ${filter}`;
}
