import "#test/assetResolutionBoundary.ts";
import { expect } from "vitest";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { missingMermaid } from "#test/missingMermaid.ts";

const note = projectFiles({ "note.md": "# Note" });

boardStory.it(
	"the board refuses to start with reinstall instructions when Mermaid cannot be resolved",
	[note, missingMermaid, deferredServing],
	function* ({ launch }) {
		expect(yield* launch()).toBe("refused: The Mermaid assets could not be found. Reinstall Work Board and restart it.");
	},
);

boardStory.it(
	"the board refuses to start with reinstall instructions when its browser asset location is invalid",
	[note, deferredServing],
	function* ({ launchWithInvalidAssetLocation }) {
		expect(yield* launchWithInvalidAssetLocation()).toBe("refused: The browser asset location is invalid. Reinstall Work Board and restart it.");
	},
);
