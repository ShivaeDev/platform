import { Cause, Effect, Exit } from "effect";
import { expect } from "vitest";
import { brokenMigration } from "#test/hostDatabaseTraits.ts";
import { host } from "#test/hostStory.ts";

host.it("a Fleet migration failure prevents provider acquisition and scheduling", [brokenMigration], function* (daemon) {
	const exit = yield* daemon.bootScheduler().pipe(Effect.exit);
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.pretty(exit.cause)).toContain("MigrationError");
	}
	expect(daemon.providerResources().providers).toBe(0);
	expect(daemon.providerLaunches()).toHaveLength(0);
});
