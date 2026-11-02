import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { parseOptions } from "#options.ts";

it.effect("arguments after -- reach Vitest unchanged, including wrapper option names and another separator", () => {
	const forwarded = ["--reruns", "--output-dir=", "--", "a test.spec.ts", "--silent=invalid"];

	return Effect.map(parseOptions(["--", ...forwarded], "/project"), (options) => {
		expect(options.vitestArgs).toEqual(forwarded);
	});
});
