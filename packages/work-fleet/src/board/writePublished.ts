import { Effect } from "effect";
import { Publication, publishOnce, replaceIfUnchanged } from "@shivaedev/work-board/server/publication.ts";
import { readPublication } from "#board/readPublication.ts";
import { ReportFileFailure } from "#reportFileFailure.ts";

export const writePublished = Effect.fn("Fleet.writePublished")(function* (
	root: string,
	realRoot: string,
	name: "status.md" | "health.json" | ".fleet-decision-closure-v1.json",
	content: string,
	owns: (source: string) => boolean,
) {
	const path = name === ".fleet-decision-closure-v1.json" ? name : `fleet/${name}`;
	const source = yield* readPublication(root, realRoot, path, {
		bytes: 8 * 1024 * 1024,
		reason: "Publication target must be a regular file under 8 MiB",
	});
	if (source !== undefined && !owns(source)) {
		return yield* Effect.fail(new ReportFileFailure({ path, reason: "Publication target contains authored content" }));
	}
	if (source === content) {
		return;
	}
	yield* (
		source === undefined
			? publishOnce({ content, path, realRoot, root })
			: replaceIfUnchanged({ content, expectedSource: source, path, realRoot, root })
	).pipe(Effect.provide(Publication.layer));
});
