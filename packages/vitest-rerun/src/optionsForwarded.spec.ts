import { expect } from "@effect/vitest";
import { argumentStory } from "#test/argumentStory.ts";

argumentStory.it("arguments after -- reach Vitest unchanged, including wrapper option names and another separator", [], function* ({ parse }) {
	const forwarded = ["--reruns", "--output-dir=", "--", "a test.spec.ts", "--silent=invalid"];

	const options = yield* parse("--", ...forwarded);

	expect(options.vitestArgs).toEqual(forwarded);
});
