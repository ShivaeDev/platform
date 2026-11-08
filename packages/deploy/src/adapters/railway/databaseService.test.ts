import { expect } from "vitest";
import { changedCmd, changedEntrypoint, postgres, registryUnavailable, singleManifest } from "#test-support/postgresStory.ts";

postgres.it(
	"the database and its volume are two declared nodes with no attachment, as Railway's config pull writes them",
	[],
	({ defineDatabase }) => {
		const { resources } = defineDatabase();

		expect(resources?.map(({ address }) => address)).toEqual(["database.Postgres", "volume.postgres-volume"]);
		expect(resources?.[1]).toEqual({
			address: "volume.postgres-volume",
			config: { alerts: { usage: { "90": {} } }, allowOnlineResize: true, region: "europe-west4", "sizeMB": 5000 },
			name: "postgres-volume",
			type: "volume",
		});
		expect(resources?.[0]).not.toHaveProperty("volumeAttachments");
		expect(resources?.[0]).not.toHaveProperty("volumeMounts");
	},
);

for (const given of [[], [singleManifest]]) {
	postgres.it("a matching image yields the Railway Postgres image", given, ({ defineDatabase }) => {
		const result = defineDatabase();

		expect(result.database?.source).toMatchObject({
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
