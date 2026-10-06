import type { TestContext } from "vitest";
import { callSite } from "#internal/callSite.ts";
import { failureReport } from "#internal/failureReport.ts";
import { describeFailure } from "#internal/render.ts";

export interface Refusal {
	readonly cause: unknown;
	readonly index: number;
}

export interface Narration {
	given: number;
	readonly lines: string[];
	refused: Refusal | undefined;
	readonly sites: Error[];
	readonly tell: (line: string) => void;
	readonly tellAt: (line: string, site: Error) => void;
}

export interface Subject<TEngine> {
	readonly engine: TEngine;
	readonly inspect: ((engine: TEngine) => unknown) | undefined;
	readonly name: string;
}

export function narrate<TEngine>(subject: Subject<TEngine>, { onTestFailed }: Pick<TestContext, "onTestFailed">): Narration {
	const narration: Narration = {
		given: 0,
		lines: [],
		refused: undefined,
		sites: [],
		tell: (line) => {
			narration.tellAt(line, callSite());
		},
		tellAt: (line, site) => {
			narration.lines.push(line);
			narration.sites.push(site);
		},
	};
	onTestFailed(({ task }) => {
		const failure = task.result?.errors?.[0];
		if (failure !== undefined) {
			failure.message = `${failure.message === "" ? describeFailure(failure) : failure.message}\n\n${failureReport(narration, subject, { file: task.file.filepath, name: task.name })}`;
		}
	});
	return narration;
}

export function tellGiven(narration: Narration, given: readonly { readonly line: string; readonly site: Error }[]): void {
	for (const part of given) {
		narration.tellAt(part.line, part.site);
	}
	narration.given = given.length;
}
