import { expect } from "vitest";
import { brokenMigration } from "#test/hostDatabaseTraits.ts";
import { host } from "#test/hostStory.ts";

host.it("a Fleet migration failure stops the daemon boot before it acquires a provider or launches work", [brokenMigration], function* (daemon) {
	const booted = yield* daemon.bootScheduler();

	expect(booted).toContain("MigrationError");
	expect({ launches: daemon.providerLaunches(), providers: daemon.providerResources().providers }).toEqual({ launches: [], providers: 0 });
});
