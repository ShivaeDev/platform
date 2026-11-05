import { Effect, Redacted, Schema } from "effect";
import { Migrator } from "effect/sql";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { defineEmailQueue } from "#server/defineEmailQueue.ts";

const Message = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Confirm"), url: Schema.Redacted(Schema.String) }),
	Schema.Struct({ _tag: Schema.Literal("Reset"), url: Schema.Redacted(Schema.String) }),
]);
export const Emails = defineEmailQueue(Message, ({ _tag, url }) =>
	Effect.succeed({
		from: "App <app@example.test>",
		html: `<a href="${Redacted.value(url)}">${_tag}</a>`,
		subject: `${_tag} your account`,
		text: `${_tag}: ${Redacted.value(url)}`,
		to: "alice@example.test",
	}),
);

const { url: databaseUrl, configured } = postgresTestUrl("PLATFORM_JOBS_TEST_DATABASE_URL");

export { configured };
export const postgres = makePostgresTestLayer({
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	prepare: false,
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});
