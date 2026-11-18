import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jsonColumns, storedByAnotherClient } from "#test/jsonColumns.ts";

const TOOL_USE = '{"type":"tool_use","id":"toolu_1","name":"search","input":{"query":"notes","limit":5}}';

jsonColumns.it(
	"a json column returns a message's keys in the order written, where a jsonb column returns them reordered",
	[],
	function* ({ readIndexed, readMessage, saveTurn }) {
		yield* saveTurn(TOOL_USE);

		yield* outcomes([
			["json message", () => readMessage(), TOOL_USE],
			["jsonb message", () => readIndexed(), '{"id":"toolu_1","name":"search","type":"tool_use","input":{"limit":5,"query":"notes"}}'],
		]);
	},
);

jsonColumns.it(
	"a json column returns integer-like keys before the others, however the message was written",
	[],
	function* ({ readMessage, saveTurn }) {
		yield* saveTurn('{"b":"first","2":"second","a":"third","1":"fourth"}');

		expect(yield* readMessage()).toBe('{"1":"fourth","2":"second","b":"first","a":"third"}');
	},
);

jsonColumns.it(
	"a json column whose value schema is a struct stores the keys in the schema's order, not the order written",
	[],
	function* ({ saveCall, storedCall }) {
		yield* saveCall('{"name":"search","id":"toolu_1"}');

		expect(yield* storedCall()).toBe('{"id":"toolu_1","name":"search"}');
	},
);

const SPACED_MESSAGE = '{"b": 1.0,   "a": 2}';

jsonColumns.it(
	"writing back a json message another client stored keeps its key order and drops its whitespace and number spelling",
	[storedByAnotherClient(SPACED_MESSAGE)],
	function* ({ rewriteMessage, storedMessage }) {
		expect(yield* storedMessage()).toBe(SPACED_MESSAGE);

		yield* rewriteMessage();

		expect(yield* storedMessage()).toBe('{"b":1,"a":2}');
	},
);

jsonColumns.it(
	"a null message is stored as SQL NULL in a json column and reads back as null",
	[],
	function* ({ readMessage, saveTurn, storedMessage }) {
		yield* saveTurn("null");

		yield* outcomes([
			["stored message", () => storedMessage(), "SQL NULL"],
			["message as read", () => readMessage(), "null"],
		]);
	},
);

jsonColumns.it(
	"a stored json array fails the read of a message whose schema is an object with a schema error",
	[storedByAnotherClient("[1]")],
	function* ({ readMessage }) {
		const read = yield* readMessage();

		expect(read).toBe("failed with a schema error");
	},
);

jsonColumns.it(
	"an equality filter on a json column fails with PostgreSQL's undefined-function error 42883, because json values have no equality operator",
	[],
	function* ({ findTurnsByMessage }) {
		const found = yield* findTurnsByMessage({ type: "text" });

		expect(found).toBe("failed with a SQL syntax error (SQLSTATE 42883)");
	},
);
