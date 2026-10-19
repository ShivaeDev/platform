import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { diagram } from "#test/diagram.ts";
import { gatedDiagrams } from "#test/screenDiagrams.ts";
import { screenMedia, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

const ONE_DIAGRAM = 1;
const LIGHT_AND_DARK_DRAWINGS = 2;

expectNoReactWarnings();

for (const initiallyDrawn of [false, true]) {
	screenStory.it(
		`keeps the current theme drawing when an older theme finishes (initially drawn: ${initiallyDrawn})`,
		[
			screenWorkspace(`diagram-theme-${initiallyDrawn}`),
			screenMedia([]),
			gatedDiagrams(),
			chromeScreen({ "notes/plan.md": `# Diagram${diagram(`Theme${initiallyDrawn}-->Drawing`)}` }),
		],
		function* ({ drawings, finishDiagram, click, readAttribute, findElements, frame, setMediaMatch, roles }) {
			yield* Effect.promise(() => eventually(() => expect(drawings()).toHaveLength(ONE_DIAGRAM)));
			if (initiallyDrawn) {
				yield* Effect.promise(() => finishDiagram(0));
			}
			click("#settings-open");
			yield* roles.click({ name: "Dark", role: "button" });
			yield* Effect.promise(() => eventually(() => expect(drawings()).toHaveLength(LIGHT_AND_DARK_DRAWINGS)));
			if (initiallyDrawn) {
				expect(readAttribute("figure svg", "data-dark")).toBe("false");
			}
			yield* Effect.promise(() => finishDiagram(1));
			expect(readAttribute("figure svg", "data-dark")).toBe("true");
			yield* Effect.promise(() => finishDiagram(0));
			yield* Effect.promise(() => frame());
			expect(readAttribute("figure svg", "data-dark")).toBe("true");
			expect(findElements("svg[data-source]")).toHaveLength(ONE_DIAGRAM);
			yield* roles.click({ name: "Compact", role: "button" });
			expect(drawings()).toHaveLength(LIGHT_AND_DARK_DRAWINGS);
			yield* roles.click({ name: "Light", role: "button" });
			yield* Effect.promise(() => eventually(() => expect(drawings()).toHaveLength(initiallyDrawn ? 2 : 3)));
			if (!initiallyDrawn) {
				yield* Effect.promise(() => finishDiagram(2));
			}
			expect(readAttribute("figure svg", "data-dark")).toBe("false");
			setMediaMatch("(prefers-color-scheme: dark)", true);
			expect(readAttribute("figure svg", "data-dark")).toBe("false");
			yield* roles.click({ name: "System", role: "button" });
			expect(readAttribute("figure svg", "data-dark")).toBe("true");
		},
	);
}
