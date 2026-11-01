import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { type FailureContext, reportOnFailure } from "#adapters/storyFailure.ts";
import { callSite } from "#internal/callSite.ts";
import { creationReport, failureReport } from "#internal/failureReport.ts";
import { hooked } from "#internal/hooked.ts";

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

export function narrateCreation(name: string, context: FailureContext) {
	return reportOnFailure(context, (test) => Effect.sync(() => creationReport(name, test)));
}

export const narrate = Effect.fnUntraced(function* <TEngine>(subject: Subject<TEngine>, context: FailureContext) {
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
	function captureFailure(stack: string | undefined) {
		return hooked(() => (subject.inspect === undefined ? subject.engine : subject.inspect(subject.engine))).pipe(
			Effect.matchCause({
				onFailure: (cause) => ({ threw: Cause.squash(cause) }),
				onSuccess: (value) => ({ value }),
			}),
			Effect.map((snapshot) =>
				failureReport(narration, { ...subject, snapshot }, { file: context.task.file.filepath, name: context.task.name, stack }),
			),
			Effect.tap((report) =>
				Effect.sync(() => {
					captured = report;
				}),
			),
		);
	}
	yield* reportOnFailure(context, (test) => (captured === undefined ? captureFailure(test.stack) : Effect.succeed(captured)));
	return { captureFailure, narration };
});

export function tellGiven(narration: Narration, given: readonly { readonly line: string; readonly site: Error }[]): void {
	for (const part of given) {
		narration.tellAt(part.line, part.site);
	}
	narration.given = given.length;
}
