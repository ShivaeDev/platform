import { engineSummary } from "#server/adapters/engineSummary.ts";
import type { FailedTest } from "#server/adapters/failureReport.ts";
import { writeSnapshot } from "#server/adapters/writeSnapshot.ts";
import type { Subject } from "#server/narration.ts";
import { describeValue, toJson } from "#server/render.ts";
import { WIDTH, wrap, wrapJson } from "#server/wrap.ts";

const INLINE_CHARACTERS = 2000;

type Snapshot = NonNullable<Subject<unknown>["snapshot"]>;

function snapshot<TEngine>(subject: Subject<TEngine>): Snapshot {
	if (subject.snapshot !== undefined) {
		return subject.snapshot;
	}
	try {
		return { value: subject.inspect === undefined ? engineSummary(subject.engine) : subject.inspect(subject.engine) };
	} catch (threw) {
		return { threw };
	}
}

export function engineSnapshot<TEngine>(subject: Subject<TEngine>, test: FailedTest): string[] {
	const heading = `The ${subject.name} when the test failed`;
	const taken = snapshot(subject);
	if ("threw" in taken) {
		return wrap(`${heading} is unknown: its inspect hook threw ${describeValue(taken.threw)}`);
	}
	if (subject.inspect === undefined) {
		return [`${heading}:`, String(taken.value), ...wrap("help: define an inspect hook in the story kit to print the engine state you need.")];
	}
	const json = toJson(taken.value);
	if (json.length <= INLINE_CHARACTERS) {
		return heading.length + 2 + json.length > WIDTH ? [`${heading}:`, ...wrapJson(json)] : [`${heading}: ${json}`];
	}
	return writeSnapshot(subject.name, test, taken.value, json.length);
}
