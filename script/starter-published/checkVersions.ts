import { Effect } from "effect";
import { requireThat } from "#package-check/io.ts";

function newer(version: string, other: string) {
	if (!(/^\d+\.\d+\.\d+$/u.test(version) && /^\d+\.\d+\.\d+$/u.test(other))) {
		return false;
	}
	const candidate = version.split(".").map(Number);
	const published = other.split(".").map(Number);
	for (const [index, value] of candidate.entries()) {
		if (value !== published[index]) {
			return value > (published[index] ?? 0);
		}
	}
	return false;
}

export const checkVersions = Effect.fn("Published.checkVersions")(function* (
	pins: Readonly<Record<string, string>>,
	latest: (name: string) => Effect.Effect<string, Error>,
	workspace: Readonly<Record<string, string>> = {},
) {
	yield* Effect.forEach(
		Object.entries(pins),
		([name, pinned]) =>
			Effect.gen(function* () {
				const published = yield* latest(name);
				const local = workspace[name] ?? "";
				const expected = newer(local, published) ? local : published;
				yield* requireThat(
					pinned === expected,
					`${name}: template pins ${pinned}, but npm latest is ${published}. Pin ${expected}, the latest published or pending workspace release.`,
				);
			}),
		{ concurrency: 4 },
	);
});
