import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { boardTokens } from "#test/boardTokens.ts";
import { diagram } from "#test/diagram.ts";
import { readingPage } from "#test/readingScreenTraits.tsx";
import { gatedDiagrams } from "#test/screenDiagrams.ts";
import { screenMedia, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { screenTheme } from "#test/screenWorkspaceTraits.ts";

expectNoReactWarnings();

for (const theme of ["light", "dark"] as const) {
	screenStory.it(
		`a diagram in the ${theme} theme is drawn in neutral Board colours with readable labels and no effects`,
		[
			screenWorkspace(`diagram-colours-${theme}`),
			screenMedia([]),
			screenTheme(theme),
			boardTokens(),
			gatedDiagrams(),
			readingPage({ "notes/plan.md": `# Diagram${diagram("Colours-->Labels")}` }, "/notes/plan.md"),
		],
		function* ({ mermaidColours, mermaidIsAskedToDraw }) {
			yield* mermaidIsAskedToDraw("Colours-->Labels", theme);

			expect(yield* mermaidColours("Colours-->Labels", theme)).toEqual({
				amber: [],
				effects: { dropShadow: "none", useGradient: false },
				offBoard: [],
				unreadable: [],
			});
		},
	);
}
