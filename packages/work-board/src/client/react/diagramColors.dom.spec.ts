import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { boardTokens } from "#test/boardTokens.ts";
import { diagram } from "#test/diagram.ts";
import { gatedDiagrams } from "#test/screenDiagrams.ts";
import { screenMedia, screenWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { chromeScreen } from "#test/screenTraits.ts";

const LIGHT_DRAWING = 0;
const DARK_DRAWING = 1;

expectNoReactWarnings();

screenStory.it(
	"draws diagrams in neutral Board colours with readable labels in light and dark",
	[
		screenWorkspace("diagram-colours"),
		screenMedia([]),
		boardTokens(),
		gatedDiagrams(),
		chromeScreen({ "notes/plan.md": `# Diagram${diagram("Colours-->Labels")}` }),
	],
	function* ({ diagramPalette, drawings, click, roles }) {
		const readable = { amber: [], effects: { dropShadow: "none", useGradient: false }, offBoard: [], unreadable: [] };
		yield* eventually(() => expect(drawings()).toHaveLength(LIGHT_DRAWING + 1));
		expect(diagramPalette(LIGHT_DRAWING)).toEqual({ ...readable, dark: false });
		click("#settings-open");
		yield* roles.click({ name: "Dark", role: "button" });
		yield* eventually(() => expect(drawings()).toHaveLength(DARK_DRAWING + 1));
		expect(diagramPalette(DARK_DRAWING)).toEqual({ ...readable, dark: true });
	},
);
