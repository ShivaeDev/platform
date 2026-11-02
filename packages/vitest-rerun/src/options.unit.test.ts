import { expect } from "@effect/vitest";
import { it } from "@shivaedev/test/it.ts";
import { parseOptions } from "#options.ts";

it.effect("arguments after -- reach Vitest unchanged, including wrapper option names and another separator", function* () {
	const forwarded = ["--reruns", "--output-dir=", "--", "a test.spec.ts", "--silent=invalid"];

	const options = yield* parseOptions(["--", ...forwarded], "/project");

	expect(options.vitestArgs).toEqual(forwarded);
});
