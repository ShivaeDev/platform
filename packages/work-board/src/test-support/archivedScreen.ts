import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { archive } from "#server/archive/run.ts";
import { folder } from "./board.ts";
import { screenStory } from "./screenStory.ts";
import { settledFixture } from "./settledFixture.ts";

export function archivedScreen() {
	return screenStory.trait("workspace", "the workspace has archived a settled question and its answer", function* (engine) {
		const notes = folder(settledFixture().files);
		yield* Effect.addFinalizer(() => Effect.sync(notes.remove));
		yield* archive(notes.root).pipe(Effect.provide(NodeServices.layer));
		engine.files = Object.fromEntries(
			readdirSync(notes.root, { encoding: "utf8", recursive: true }).flatMap((file) => {
				const path = join(notes.root, file);
				return statSync(path).isFile() ? [[file, readFileSync(path, "utf8")]] : [];
			}),
		);
		engine.path = "/_board/item/settled/";
		engine.options = { home: undefined };
	});
}
