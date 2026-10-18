import { rmSync } from "node:fs";
import { join } from "node:path";
import { Deferred, Effect, Fiber } from "effect";
import type { HostFixture } from "#test/fleetHost.ts";
import { withFollower } from "#test/follower.ts";
import type { Follower } from "#test/followerProcess.ts";

export const ownedFollower = Effect.fn("FollowerTest.ownedFollower")(function* (fixture: HostFixture) {
	const started = yield* Deferred.make<Follower>();
	const running = yield* withFollower(fixture.configFile, "watch", [], { follow: true }, (follower) =>
		Effect.gen(function* () {
			// An owned test daemon must not depend on the client's discovery fallback.
			rmSync(join(fixture.host.boardDir, ".fleet-port"));
			yield* Deferred.succeed(started, follower);
			return yield* Effect.never;
		}),
	).pipe(Effect.forkScoped);
	return yield* Effect.raceFirst(Deferred.await(started), Fiber.join(running));
});
