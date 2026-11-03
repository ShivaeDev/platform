import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";
import { operationStorageStory } from "#test/operationStorageStory.ts";

const OPERATION = "synthetic-worker";
const RECEIPT = { sessionId: "session", turnId: "turn" };
const AMBIGUOUS = /^session persistence/u;

operationStorageStory.it(
	"an operation held by a current and an archived record has no single owner, and acknowledging it changes neither record",
	[],
	function* ({ acknowledgeSession, owner, recordsHolding, insert, reload }) {
		const current = namedRecord("current", [namedAttempt("worker")]);
		const { workId: _workId, ...cycle } = current;
		yield* insert(current);
		yield* insert({ ...namedRecord("archived", []), history: [{ ...cycle, archivedAt: 100 }] });
		const savedCurrent = yield* reload("current");
		const savedArchived = yield* reload("archived");
		yield* outcomes([
			["records holding the operation", () => recordsHolding(OPERATION), ["archived", "current"]],
			["owner", () => owner(OPERATION), "no single owner"],
		]);

		const acknowledgement = yield* acknowledgeSession(OPERATION, "session");

		expect(acknowledgement).toMatch(AMBIGUOUS);
		yield* outcomes([
			["current record", () => reload("current"), savedCurrent],
			["archived record", () => reload("archived"), savedArchived],
		]);
	},
);

operationStorageStory.it(
	"acknowledging a turn records its exact receipt on the owning record's attempt",
	[],
	function* ({ acknowledgeSession, acknowledgeTurn, owner, insert, reload }) {
		yield* insert(namedRecord("one", [namedAttempt("worker")]));
		yield* insert(namedRecord("other", []));
		expect(yield* owner(OPERATION)).toBe("one");
		yield* acknowledgeSession(OPERATION, "session");

		yield* acknowledgeTurn(OPERATION, RECEIPT);

		expect((yield* reload("one"))?.value.attempts).toEqual([
			{ ...namedAttempt("worker"), receipt: RECEIPT, sessionId: "session", startedAt: expect.any(Number), status: "accepted" },
		]);
	},
);

operationStorageStory.it(
	"a turn acknowledgement that names another turn is refused and changes nothing",
	[],
	function* ({ acknowledgeSession, acknowledgeTurn, insert, reload }) {
		yield* insert(namedRecord("one", [namedAttempt("worker")]));
		yield* acknowledgeSession(OPERATION, "session");
		yield* acknowledgeTurn(OPERATION, RECEIPT);
		const acknowledged = yield* reload("one");

		const acknowledgement = yield* acknowledgeTurn(OPERATION, { ...RECEIPT, turnId: "wrong" });

		expect(acknowledgement).toMatch(AMBIGUOUS);
		expect(yield* reload("one")).toEqual(acknowledged);
	},
);

operationStorageStory.it(
	"another writer giving a second record the operation makes its owner ambiguous and refuses its acknowledgement",
	[],
	function* ({ acknowledgeSession, acknowledgeTurn, owner, insert, reload, replace }) {
		yield* insert(namedRecord("one", [namedAttempt("worker")]));
		const other = yield* insert(namedRecord("other", []));
		yield* acknowledgeSession(OPERATION, "session");
		const acknowledged = yield* reload("one");

		yield* replace("other", other.version, { ...other.value, attempts: [namedAttempt("worker")] });

		yield* outcomes([
			["owner", () => owner(OPERATION), "no single owner"],
			["acknowledgement", () => acknowledgeTurn(OPERATION, RECEIPT), expect.stringMatching(AMBIGUOUS)],
			["owning record", () => reload("one"), acknowledged],
		]);
	},
);
