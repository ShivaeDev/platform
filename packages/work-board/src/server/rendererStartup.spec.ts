import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { rendererStartupStory } from "#test/rendererStartupStory.ts";

for (const embedded of [false, true]) {
	rendererStartupStory.it(
		`the ${embedded ? "embedded" : "production"} server serves the reading shell without constructing a renderer`,
		[],
		function* ({ serverStarts, homeResponse, rendererConstructions }) {
			yield* serverStarts(embedded);

			yield* outcomes([
				[
					"home page",
					() => homeResponse(),
					expect.objectContaining({ body: expect.stringContaining("data-board-react-root"), status: HttpStatus.fromLiteral("OK") }),
				],
				["server renderer constructions", () => rendererConstructions(), 0],
			]);
		},
	);
}
