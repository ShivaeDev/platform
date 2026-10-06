import { relative } from "node:path";
import { locate } from "#internal/callSite.ts";
import { engineSnapshot } from "#internal/engineSnapshot.ts";
import type { Narration, Subject } from "#internal/narration.ts";
import { describeValue } from "#internal/render.ts";

export interface FailedTest {
	readonly file: string;
	readonly name: string;
}

const WIDEST_LINE = 60;

export function failureReport<TEngine>(narration: Narration, subject: Subject<TEngine>, test: FailedTest): string {
	try {
		return [
			`test-story: this test tells a story over a real ${subject.name}. "given" lines are its traits; the other lines were told by verbs and engine steps as they ran, each beside the spec line that caused it when known. ✗ marks where it stopped.`,
			...storyRows(narration, test.file),
			"",
			...engineSnapshot(subject, test),
			"",
			`The traits, verbs and engine steps live in the ${subject.name} story kit this test imports. Rerun: vitest run ${relative(process.cwd(), test.file)} -t "${test.name.replaceAll(/[$()*+.?[\\\]^{|}]/gu, "\\$&")}"`,
		].join("\n");
	} catch (error) {
		return `test-story could not print the story of this ${subject.name}: ${describeValue(error)}`;
	}
}

function storyRows(narration: Narration, testFile: string): string[] {
	const width = Math.min(WIDEST_LINE, Math.max(0, ...narration.lines.map((line) => line.length)));
	const rows = narration.lines.map((line, index) => {
		const refused = narration.refused?.index === index;
		const where = [locate(narration.sites[index], testFile), refused ? "refused" : undefined].filter((part) => part !== undefined);
		return `${refused ? "✗" : " "} ${index < narration.given ? "given" : "     "}  ${line.padEnd(width)}  ${where.join("  ")}`.trimEnd();
	});
	if (narration.refused !== undefined) {
		return rows;
	}
	return [...rows, `✗        the test failed ${rows.length === 0 ? "before the story told a line" : "after the line above"}`];
}
