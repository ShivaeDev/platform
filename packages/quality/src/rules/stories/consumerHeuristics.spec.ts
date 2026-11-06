import { authSql } from "#rules/stories/authSql.ts";
import { domainOutcomes } from "#rules/stories/domainOutcomes.ts";
import { waitOnEvents } from "#rules/stories/waitOnEvents.ts";
import { durableEvents, durableSessions, eventWaits } from "#test/consumerHeuristics.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

ruleStory.it(
	"auth-sql accepts durable agent sessions while keeping auth-owned sessions private",
	[repositoryHas(...durableSessions)],
	function* ({ check, locations }) {
		yield* check(authSql, { owners: [{ glob: "src/identity/**", reason: "Identity owns Better Auth storage." }] });

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/leak.ts:1"]));
	},
);

ruleStory.it(
	"domain-outcomes accepts a domain event schema's tag and durable history tag reads",
	[repositoryHas(durableEvents)],
	function* ({ check, findings }) {
		yield* check(domainOutcomes);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);

for (const [name, body, rejected] of [
	[
		"an event stream consumed until the matching state",
		'yield* events.pipe(Stream.filter((event) => event.state === "ready"), Stream.take(1), Stream.runCollect);',
		false,
	],
	[
		"an event queue consumed through Effect.repeat",
		'yield* Queue.take(events).pipe(Effect.repeat({ until: (event) => event.state === "ready" }));',
		false,
	],
	[
		"a polling read beside an unrelated event wait",
		'yield* Effect.all([Queue.take(unrelated), Effect.repeat(readState(), { until: (state) => state === "ready" })]);',
		true,
	],
	["a loop of state reads", 'while ((yield* readState()) !== "ready") { yield* Effect.yieldNow; }', true],
	["repeated state reads", 'yield* Effect.repeat(readState(), { until: (state) => state === "ready" });', true],
	["sleeping between reads", 'yield* Effect.sleep("10 millis"); yield* readState();', true],
] as const) {
	ruleStory.it(
		`wait-on-events ${rejected ? "reports" : "accepts"} ${name} in a helper named eventually`,
		[repositoryHas(...eventWaits(body))],
		function* ({ check, locations }) {
			yield* check(waitOnEvents);

			yield* assertThat(yield* locations(), (actual) => actual.toEqual(rejected ? ["src/test-support/reconciliation.ts:1"] : []));
		},
	);
}

ruleStory.it(
	"wait-on-events accepts an event-consuming helper named waitFor",
	[
		repositoryHas(
			...eventWaits('yield* events.pipe(Stream.filter((event) => event.state === "ready"), Stream.take(1), Stream.runCollect);', "waitFor"),
		),
	],
	function* ({ check, findings }) {
		yield* check(waitOnEvents);

		yield* assertThat(yield* findings(), (actual) => actual.toEqual([]));
	},
);

ruleStory.it(
	"auth-sql recognizes renamed auth tables from schema columns and preserves unrelated schema-qualified sessions",
	[
		repositoryHas(
			{
				content:
					"CREATE TABLE logins (id text, token text, user_id text, expires_at timestamp); CREATE TABLE agents.session (id text, history jsonb);",
				path: "src/schema.sql",
			},
			{ content: "sql`SELECT token FROM logins`; sql`SELECT history FROM agents.session`;", path: "src/reads.ts" },
		),
	],
	function* ({ check, locations }) {
		yield* check(authSql);

		yield* assertThat(yield* locations(), (actual) => actual.toEqual(["src/reads.ts:1", "src/schema.sql:1"]));
	},
);
