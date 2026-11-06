import { expect } from "vitest";
import { changedCmd, changedEntrypoint, postgres, registryUnavailable, singleManifest } from "#test-support/postgresStory.ts";

for (const given of [[], [singleManifest]]) {
	postgres.it("a matching image yields a database with immediate minor and patch updates", given, ({ defineDatabase }) => {
		const result = defineDatabase();

		expect(result.database?.source).toMatchObject({
			autoUpdates: { schedule: null, tagMode: "sha", type: "minor" },
			image: "ghcr.io/railwayapp-templates/postgres-ssl:18",
		});
	});
}

for (const [trait, expected] of [
	[changedEntrypoint, 'received ENTRYPOINT ["/new-entrypoint"]'],
	[changedCmd, 'CMD ["postgres"]'],
] as const) {
	postgres.it(`a changed startup chain refuses the definition: ${expected}`, [trait], ({ defineDatabase }) => {
		const result = defineDatabase();

		expect(result.refused).toContain(expected);
		expect(result.refused).toContain("Revise the page-cache trim startup chain before deploying");
		expect(result.database).toBeUndefined();
	});
}

postgres.it("an unavailable registry refuses the definition with its HTTP failure", [registryUnavailable], ({ defineDatabase }) => {
	const result = defineDatabase();

	expect(result.refused).toContain("startup chain verification failed: Registry request");
	expect(result.refused).toContain("HTTP 503");
	expect(result.database).toBeUndefined();
});
