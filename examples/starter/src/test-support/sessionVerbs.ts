import { Effect } from "effect";
import { expect, vi } from "vitest";
import type { Engine } from "./applicationState.ts";

export function sessionVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		concurrentProfilesAreIsolated: Effect.fn("AppStory.concurrentProfilesAreIsolated")(function* () {
			tell("alice and bob read their own profiles concurrently");
			const alice = engine.actors.get("alice");
			const bob = engine.actors.get("bob");
			if (alice === undefined || bob === undefined) {
				return yield* Effect.die("Both accounts must be signed in");
			}
			const profiles = yield* Effect.all(
				Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? alice : bob).notes.whoami()),
				{ concurrency: "unbounded" },
			);
			const aliceProfile = profiles[0];
			const bobProfile = profiles[1];
			expect(aliceProfile).toEqual({ email: "alice@app.test", id: expect.any(String), name: "alice" });
			expect(bobProfile).toEqual({ email: "bob@app.test", id: expect.any(String), name: "bob" });
			expect(aliceProfile?.id).not.toBe(bobProfile?.id);
			profiles.forEach((profile, index) => {
				expect(profile).toEqual(index % 2 === 0 ? aliceProfile : bobProfile);
			});
			if (aliceProfile === undefined) {
				return yield* Effect.die("Missing alice profile");
			}
			return aliceProfile;
		}),
		noteIs: Effect.fn("AppStory.noteIs")(function* (
			id: number,
			expected: { readonly id: number; readonly title: string; readonly version: number; readonly wordCount: number | null },
		) {
			tell(`wait for note ${id} to show its counted title`);
			const alice = engine.actors.get("alice");
			if (alice === undefined) {
				return yield* Effect.die("Alice must be signed in");
			}
			yield* Effect.promise(() =>
				vi.waitFor(async () => expect(await Effect.runPromise(alice.notes.get({ id }))).toEqual(expected), { timeout: 5000 }),
			);
		}),
	};
}
