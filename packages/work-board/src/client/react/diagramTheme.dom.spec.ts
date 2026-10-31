import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { themedDiagramPlan } from "#test/diagramPlans.ts";
import { screenStory } from "#test/screenStory.ts";

expectNoReactWarnings();

// Mermaid keeps drawings for the whole file, so every story draws its own diagram.

screenStory.it(
	"a light drawing that finishes after the reader switched to dark does not replace the dark drawing",
	themedDiagramPlan("Theme-->Late"),
	function* ({ chooseAppearance, diagramFigures, mermaidDraws, mermaidIsAskedToDraw, openSettings }) {
		yield* mermaidIsAskedToDraw("Theme-->Late");
		yield* openSettings();
		yield* chooseAppearance("Dark");
		yield* mermaidIsAskedToDraw("Theme-->Late", "dark");
		yield* mermaidDraws("Theme-->Late", "dark");

		yield* mermaidDraws("Theme-->Late", "light");

		expect(yield* diagramFigures()).toEqual([{ drawing: "Theme-->Late in dark", source: "hidden", state: "drawn" }]);
	},
);

screenStory.it(
	"switching a drawn diagram to dark keeps the light drawing until the dark drawing is ready",
	themedDiagramPlan("Theme-->Switch"),
	function* ({ chooseAppearance, diagramFigures, mermaidDraws, mermaidIsAskedToDraw, openSettings }) {
		yield* mermaidIsAskedToDraw("Theme-->Switch");
		yield* mermaidDraws("Theme-->Switch");
		yield* openSettings();

		yield* chooseAppearance("Dark");

		yield* mermaidIsAskedToDraw("Theme-->Switch", "dark");
		expect(yield* diagramFigures()).toEqual([{ drawing: "Theme-->Switch in light", source: "hidden", state: "drawn" }]);

		yield* mermaidDraws("Theme-->Switch", "dark");

		expect(yield* diagramFigures()).toEqual([{ drawing: "Theme-->Switch in dark", source: "hidden", state: "drawn" }]);
	},
);

screenStory.it(
	"changing the density does not ask Mermaid to draw again",
	themedDiagramPlan("Theme-->Density"),
	function* ({ chooseAppearance, drawingRequests, mermaidDraws, mermaidIsAskedToDraw, openSettings }) {
		yield* mermaidIsAskedToDraw("Theme-->Density");
		yield* mermaidDraws("Theme-->Density");
		yield* openSettings();

		yield* chooseAppearance("Compact");

		expect(yield* drawingRequests()).toEqual(["Theme-->Density in light"]);
	},
);

screenStory.it(
	"switching back to light shows the light drawing Mermaid already made without drawing it again",
	themedDiagramPlan("Theme-->Return"),
	function* ({ chooseAppearance, diagramFigures, drawingRequests, mermaidDraws, mermaidIsAskedToDraw, openSettings }) {
		yield* mermaidIsAskedToDraw("Theme-->Return");
		yield* mermaidDraws("Theme-->Return");
		yield* openSettings();
		yield* chooseAppearance("Dark");
		yield* mermaidIsAskedToDraw("Theme-->Return", "dark");
		yield* mermaidDraws("Theme-->Return", "dark");

		yield* chooseAppearance("Light");

		yield* outcomes([
			["diagrams", () => diagramFigures(), [{ drawing: "Theme-->Return in light", source: "hidden", state: "drawn" }]],
			["Mermaid requests", () => drawingRequests(), ["Theme-->Return in light", "Theme-->Return in dark"]],
		]);
	},
);

screenStory.it(
	"with Light chosen, a diagram stays light when the system turns dark",
	themedDiagramPlan("Theme-->Chosen"),
	function* ({ diagramFigures, drawingRequests, mermaidDraws, mermaidIsAskedToDraw, setMediaMatch }) {
		yield* mermaidIsAskedToDraw("Theme-->Chosen");
		yield* mermaidDraws("Theme-->Chosen");

		yield* setMediaMatch("(prefers-color-scheme: dark)", true);

		yield* outcomes([
			["diagrams", () => diagramFigures(), [{ drawing: "Theme-->Chosen in light", source: "hidden", state: "drawn" }]],
			["Mermaid requests", () => drawingRequests(), ["Theme-->Chosen in light"]],
		]);
	},
);

screenStory.it(
	"with System chosen, a diagram is drawn dark when the system turns dark",
	themedDiagramPlan("Theme-->System", "system"),
	function* ({ diagramFigures, mermaidDraws, mermaidIsAskedToDraw, setMediaMatch }) {
		yield* mermaidIsAskedToDraw("Theme-->System");
		yield* mermaidDraws("Theme-->System");

		yield* setMediaMatch("(prefers-color-scheme: dark)", true);

		yield* mermaidIsAskedToDraw("Theme-->System", "dark");
		yield* mermaidDraws("Theme-->System", "dark");
		expect(yield* diagramFigures()).toEqual([{ drawing: "Theme-->System in dark", source: "hidden", state: "drawn" }]);
	},
);
