import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import type { TestContext } from "vitest";
import { callSite } from "#internal/callSite.ts";
import { failureReport } from "#internal/failureReport.ts";
import { hooked } from "#internal/hooked.ts";
import { describeFailure } from "#internal/render.ts";

export interface Refusal {
	readonly cause: unknown;
	readonly index: number;
}

export interface Narration {
	at: Error | undefined;
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
	readonly snapshot?: { readonly value: unknown } | { readonly threw: unknown };
}

export function narrate<TEngine>(subject: Subject<TEngine>, { onTestFailed, task }: Pick<TestContext, "onTestFailed" | "task">) {
	let captured: string | undefined;
	const narration: Narration = {
		at: undefined,
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
			narration.at = site;
		},
	};
	onTestFailed(({ task: failedTask }) => {
		const failure = failedTask.result?.errors?.[0];
		if (failure !== undefined) {
			failure.message = `${failure.message === "" ? describeFailure(failure) : failure.message}\n\n${captured ?? failureReport(narration, subject, { file: task.file.filepath, name: task.name, stack: failure.stack })}`;
		}
	});
	return {
		captureFailure: (stack: string | undefined) =>
			hooked(() => (subject.inspect === undefined ? subject.engine : subject.inspect(subject.engine))).pipe(
				Effect.matchCause({
					onFailure: (cause) => ({ threw: Cause.squash(cause) }),
					onSuccess: (value) => ({ value }),
				}),
				Effect.tap((snapshot) =>
					Effect.sync(() => {
						captured = failureReport(narration, { ...subject, snapshot }, { file: task.file.filepath, name: task.name, stack });
					}),
				),
			),
		narration,
	};
}

export function tellGiven(narration: Narration, given: readonly { readonly line: string; readonly site: Error }[]): void {
	for (const part of given) {
		narration.tellAt(part.line, part.site);
	}
	narration.given = given.length;
}
