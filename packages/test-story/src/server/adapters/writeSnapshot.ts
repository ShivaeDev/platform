import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import process from "node:process";
import type { FailedTest } from "#internal/failureReport.ts";
import { describeValue, toJson } from "#internal/render.ts";
import { wrap } from "#internal/wrap.ts";

function slug(text: string): string {
	return text
		.toLowerCase()
		.replaceAll(/[^a-z0-9.]+/gu, "-")
		.slice(0, 80);
}

export function writeSnapshot(name: string, test: FailedTest, value: unknown, characters: number): string[] {
	const heading = `The ${name} when the test failed`;
	const file = join(process.cwd(), "node_modules", ".cache", "test-story", `${slug(basename(test.file))}--${slug(test.name)}--${slug(name)}.json`);
	try {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, toJson(value, 2));
	} catch (error) {
		return wrap(`${heading} could not be written to ${relative(process.cwd(), file)}: ${describeValue(error)}`);
	}
	return wrap(`${heading} is ${characters} characters of JSON, too long to print here. Read it in ${relative(process.cwd(), file)}`);
}
