import "#test/assetResolutionBoundary.ts";
import { NodeServices } from "@effect/platform-node";
import { Effect, Path, PlatformError } from "effect";
import { expect } from "vitest";
import { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { missingMermaid } from "#test/missingMermaid.ts";
import { MermaidMissing } from "./assets.ts";

boardStory.it(
	"refuses startup with reinstall instructions when Mermaid cannot resolve",
	[projectFiles({ "note.md": "# Note" }), missingMermaid, deferredServing],
	function* ({ start }) {
		const failure = yield* start().pipe(Effect.flip);
		expect(failure).toBeInstanceOf(MermaidMissing);
		expect(failure.message).toContain("Reinstall Work Board and restart it");
	},
);
boardStory.it(
	"reports an invalid browser bundle location as a typed startup failure",
	[projectFiles({ "note.md": "# Note" }), deferredServing],
	function* ({ start }) {
		const path = yield* Path.Path.pipe(Effect.provide(NodeServices.layer));
		const failure = yield* start({
			path: {
				...path,
				fromFileUrl: () => Effect.fail(new PlatformError.BadArgument({ description: "Invalid module URL", method: "fromFileUrl", module: "Path" })),
			},
		}).pipe(Effect.flip);
		expect(failure).toBeInstanceOf(InternalServerError);
		expect(failure).toMatchObject({ message: "The browser asset location is invalid. Reinstall Work Board and restart it." });
	},
);
