import { expect } from "vitest";
import { schemaKit } from "#test/schema/kit.ts";
import { installed } from "#test/schema/traits.ts";

for (const schema of ["pgboss", "jobs_test"]) {
	for (const [artifact, name] of [
		["table", "effect_job_deferral"],
		["index", "effect_job_deferral_keep_until"],
		["function", "effect_stately_deferral()"],
		["trigger", "effect_stately_deferral trigger"],
	] as const) {
		schemaKit.it(
			`the ready ${schema} schema becomes not-ready naming its missing deferral ${artifact}, and migration restores readiness`,
			[installed(schema)],
			function* ({ answered, checkSchema, migrateSchema, removeDeferralArtifact }) {
				yield* checkSchema(schema);
				expect(yield* answered()).toBe("done");

				yield* removeDeferralArtifact(schema, artifact);

				yield* checkSchema(schema);
				expect(yield* answered()).toEqual(expect.stringContaining(`schema ${schema}, missing ${name}`));

				yield* migrateSchema(schema);

				yield* checkSchema(schema);
				expect(yield* answered()).toBe("done");
			},
		);
	}
	for (const [artifact, name] of [
		["function", "effect_job_changed()"],
		["trigger", "effect_job_changed trigger"],
	] as const) {
		schemaKit.it(
			`the ready ${schema} schema detects its missing inspection ${artifact} and migration restores it`,
			[installed(schema)],
			function* ({ answered, checkSchema, migrateSchema, removeInspectionArtifact }) {
				yield* checkSchema(schema);
				expect(yield* answered()).toBe("done");

				yield* removeInspectionArtifact(schema, artifact);

				yield* checkSchema(schema);
				expect(yield* answered()).toEqual(expect.stringContaining(`schema ${schema}, missing ${name}`));

				yield* migrateSchema(schema);

				yield* checkSchema(schema);
				expect(yield* answered()).toBe("done");
			},
		);
	}
}
