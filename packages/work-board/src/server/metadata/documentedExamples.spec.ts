import { expect } from "vitest";
import { documentedExamples } from "#test/documentedExamples.ts";
import { documentedSourceStory, sourceExample } from "#test/documentedSourceStory.ts";

for (const example of documentedExamples) {
	documentedSourceStory.it(
		`${example.document} example ${example.number} parses without losing metadata or rejecting Markdown components`,
		[sourceExample(example.document, example.number)],
		function* ({ metadata, packet, rendered }) {
			expect((yield* metadata()).diagnostics).toEqual([]);
			yield* packet("");
			expect((yield* rendered()).diagnostics).toEqual([]);
		},
	);
}
