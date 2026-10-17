import { expect } from "vitest";
import { holdsParallelQueries, postgresStory, hasUsers as postgresUsers } from "#test/postgresStory.ts";
import { controlledRows, controlledUsers } from "#test/queryControls.ts";
import { controlsQueries, hasUsers, sqliteStory } from "#test/sqlite/story.ts";

postgresStory.it(
	"does not serialize queries outside a transaction",
	[postgresUsers(controlledUsers), holdsParallelQueries()],
	function* ({ parallelQueries }) {
		const result = yield* parallelQueries();
		expect(result.maximumActive).toBe(2);
		expect(result.results).toEqual([controlledRows, controlledRows]);
	},
);

sqliteStory.it(
	"serializes queries that share a transaction executor",
	[hasUsers(controlledUsers), controlsQueries("serial")],
	function* ({ queryProbes }) {
		const result = yield* queryProbes.serialized();
		expect(result.startedBeforeRelease).toBe(1);
		expect(result.results).toEqual([controlledRows, controlledRows]);
		expect(result.maximumActive).toBe(1);
	},
);

sqliteStory.it(
	"releases a transaction query permit after failure",
	[hasUsers(controlledUsers), controlsQueries("failure")],
	function* ({ queryProbes }) {
		const result = yield* queryProbes.retry();
		expect(result.failed).toBe(true);
		expect(result.rows).toEqual(controlledRows);
	},
);

sqliteStory.it(
	"holds a transaction query permit until interrupted work settles",
	[hasUsers(controlledUsers), controlsQueries("serial")],
	function* ({ queryProbes }) {
		const result = yield* queryProbes.interrupt();
		expect(result.attemptsBeforeRelease).toBe(1);
		expect(result.rows).toEqual(controlledRows);
	},
);

sqliteStory.it(
	"keeps a root stream incremental when root queries share an access permit",
	[hasUsers(controlledUsers), controlsQueries("stream")],
	function* ({ queryProbes }) {
		const result = yield* queryProbes.incremental();
		expect(result.rows).toEqual(controlledRows);
		expect(result.events).toEqual(["source:start", "downstream:1", "downstream:2", "downstream:3", "source:end"]);
	},
);

sqliteStory.it(
	"buffers a transaction stream before running downstream effects",
	[hasUsers(controlledUsers), controlsQueries("stream")],
	function* ({ queryProbes }) {
		const result = yield* queryProbes.buffered();
		expect(result.rows).toEqual([true, true, true]);
		expect(result.events).toEqual(["source:start", "source:end", "lookup", "lookup", "lookup"]);
	},
);
