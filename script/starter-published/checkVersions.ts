import { Effect } from "effect";
import { requireThat } from "#package-check/io.ts";

export const checkVersions = Effect.fn("Published.checkVersions")(function* (
	pins: Readonly<Record<string, string>>,
	latest: (name: string) => Effect.Effect<string, Error>,
) {
	yield* Effect.forEach(
		Object.entries(pins),
		([name, pinned]) =>
			Effect.gen(function* () {
				const published = yield* latest(name);
				yield* requireThat(
					pinned === published,
					`${name}: template pins ${pinned}, but npm latest is ${published}. Update examples/starter/published-versions.json before releasing create-app.`,
				);
			}),
		{ concurrency: 4 },
	);
});
