import { expect } from "vitest";
import { parseDocument } from "yaml";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { liveForm } from "#test/answerTraits.ts";
import { EDGE_ATTENTION_SOURCE } from "#test/coverageEdges.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

for (const constraints of ["", 'Keep "quoted" text: yes\n---\nPreserve café and 日本語.']) {
	screenStory.it(
		`the handoff preview matches the saved header with ${constraints ? "multiline constraints" : "no constraints"}, except the server's preparation time`,
		[liveForm("handoff")],
		function* ({ fillHandoff, handoffPreview, pressPrepareHandoff, previewLiveForm, readSessionFiles }) {
			yield* fillHandoff("Agent name", "agent-local");
			yield* fillHandoff("Goal", 'Review "keyboard": focus\nKeep the context.');
			yield* fillHandoff("Constraints (optional)", constraints);
			yield* fillHandoff("Next step", "Inspect the current source.");
			yield* previewLiveForm("handoff");
			const preview = yield* handoffPreview();
			const header: unknown = JSON.parse(preview.slice(preview.indexOf("{"), preview.lastIndexOf("}") + 1));

			yield* pressPrepareHandoff();

			const files = yield* readSessionFiles("handoffs");
			expect(files).toEqual([expect.stringContaining("handoff:")]);
			const saved = metadataParse(files[0] ?? "");
			expect(saved.diagnostics).toEqual([]);
			expect(saved.fields.handoff?.preparedAt).toEqual(expect.any(Number));
			expect(saved.body).toBe(EDGE_ATTENTION_SOURCE);
			const persisted = parseDocument(saved.raw?.slice(4, -4) ?? "");
			persisted.deleteIn(["handoff", "prepared_at"]);
			expect(header).toEqual(persisted.toJS());
		},
	);
}
