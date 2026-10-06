import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import type { FailedTest } from "#internal/failureReport.ts";
import type { Subject } from "#internal/narration.ts";
import { describeValue, toJson } from "#internal/render.ts";
import { WIDTH, wrap, wrapJson } from "#internal/wrap.ts";

const INLINE_CHARACTERS = 2000;

type Snapshot = { readonly value: unknown } | { readonly threw: unknown };

function snapshot<TEngine>(subject: Subject<TEngine>): Snapshot {
	try {
		return { value: subject.inspect === undefined ? subject.engine : subject.inspect(subject.engine) };
	} catch (threw) {
		return { threw };
	}
}

function slug(text: string): string {
	return text
		.toLowerCase()
		.replaceAll(/[^a-z0-9.]+/gu, "-")
		.slice(0, 80);
}

export function engineSnapshot<TEngine>(subject: Subject<TEngine>, test: FailedTest): string[] {
	const heading = `The ${subject.name} when the test failed`;
	const taken = snapshot(subject);
	if ("threw" in taken) {
		return wrap(`${heading} is unknown: its inspect hook threw ${describeValue(taken.threw)}`);
	}
	const json = toJson(taken.value);
	if (json.length <= INLINE_CHARACTERS) {
		return heading.length + 2 + json.length > WIDTH ? [`${heading}:`, ...wrapJson(json)] : [`${heading}: ${json}`];
	}
	const file = join(
		process.cwd(),
		"node_modules",
		".cache",
		"test-story",
		`${slug(basename(test.file))}--${slug(test.name)}--${slug(subject.name)}.json`,
	);
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, toJson(taken.value, 2));
	return wrap(`${heading} is ${json.length} characters of JSON, too long to print here. Read it in ${relative(process.cwd(), file)}`);
}
