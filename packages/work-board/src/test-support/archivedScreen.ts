import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { act } from "react";
import { loadQuery } from "@shivaedev/react/loadQuery.ts";
import { documentQuery } from "#client/react/routeQuery.ts";
import { archive } from "#server/archive/run.ts";
import { watchChanges } from "#server/files/changes.ts";
import { searchSnapshot } from "#server/search/snapshot.ts";
import { folder } from "./board.ts";
import { screenStory } from "./screenStory.ts";
import { settledFixture } from "./settledFixture.ts";

export function archivedScreen() {
	return screenStory.trait("workspace", "the workspace has archived a settled question and its answer", function* (engine) {
		const notes = folder(settledFixture().files);
		yield* Effect.addFinalizer(() => Effect.sync(notes.remove));
		const snapshot = yield* Effect.gen(function* () {
			yield* archive(notes.root);
			const changes = yield* watchChanges(notes.root);
			return yield* yield* searchSnapshot(notes.root, undefined, changes);
		}).pipe(Effect.provide(NodeServices.layer));
		engine.files = Object.fromEntries(
			readdirSync(notes.root, { encoding: "utf8", recursive: true }).flatMap((file) => {
				const path = join(notes.root, file);
				return statSync(path).isFile() ? [[file, readFileSync(path, "utf8")]] : [];
			}),
		);
		engine.path = "/_board/item/settled/";
		engine.options = { index: Effect.succeed(snapshot) };
	});
}

export const archivedReadingReady = screenStory.trait("screen", "the archived item's document query finishes", function* (engine) {
	const { api, view, router } = engine;
	if (!(api && view && router)) {
		throw new Error("The archive reader has not opened");
	}
	yield* Effect.promise(() =>
		act(async () => {
			await loadQuery(view.registry, documentQuery(api, engine.path), { abortController: new AbortController() });
			await router.load();
		}),
	);
});
