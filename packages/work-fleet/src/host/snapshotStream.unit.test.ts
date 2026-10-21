import { expect } from "@effect/vitest";
import { Stream } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { snapshotStream } from "#host/snapshotStream.ts";

it.effect("each follower selects its initial active set and keeps subsequent terminal outcomes", function* () {
	const snapshots = Stream.make(
		[
			{ stage: "working", workId: "one" },
			{ stage: "released", workId: "old" },
		],
		[
			{ stage: "released", workId: "one" },
			{ stage: "working", workId: "new" },
		],
	);
	expect(yield* snapshotStream(snapshots, []).pipe(Stream.runCollect)).toEqual([
		[{ stage: "working", workId: "one" }],
		[{ stage: "released", workId: "one" }],
	]);
	expect(yield* snapshotStream(snapshots, ["old", "new"]).pipe(Stream.runCollect)).toEqual([
		[{ stage: "released", workId: "old" }],
		[{ stage: "working", workId: "new" }],
	]);
});
