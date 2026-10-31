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
	function* ({ acknowledgeSession, owner, recordsHolding, store }) {
		const current = namedRecord("current", [namedAttempt("worker")]);
		const { workId: _workId, ...cycle } = current;
		yield* store.insert(current);
		yield* store.insert({ ...namedRecord("archived", []), history: [{ ...cycle, archivedAt: 100 }] });
		const savedCurrent = yield* store.load("current");
		const savedArchived = yield* store.load("archived");
		yield* outcomes([
			["records holding the operation", () => recordsHolding(OPERATION), ["archived", "current"]],
			["owner", () => owner(OPERATION), "no single owner"],
		]);

		const acknowledgement = yield* acknowledgeSession(OPERATION, "session");

		expect(acknowledgement).toMatch(AMBIGUOUS);
		yield* outcomes([
			["current record", () => store.load("current"), savedCurrent],
			["archived record", () => store.load("archived"), savedArchived],
		]);
	},
);

operationStorageStory.it(
	"acknowledging a turn records its exact receipt on the owning record's attempt",
	[],
	function* ({ acknowledgeSession, acknowledgeTurn, owner, store }) {
		yield* store.insert(namedRecord("one", [namedAttempt("worker")]));
		yield* store.insert(namedRecord("other", []));
		expect(yield* owner(OPERATION)).toBe("one");
		yield* acknowledgeSession(OPERATION, "session");

		yield* acknowledgeTurn(OPERATION, RECEIPT);

		expect((yield* store.load("one"))?.value.attempts).toEqual([
			{ ...namedAttempt("worker"), receipt: RECEIPT, sessionId: "session", startedAt: expect.any(Number), status: "accepted" },
		]);
	},
);

operationStorageStory.it(
	"a turn acknowledgement that names another turn is refused and changes nothing",
	[],
	function* ({ acknowledgeSession, acknowledgeTurn, store }) {
		yield* store.insert(namedRecord("one", [namedAttempt("worker")]));
		yield* acknowledgeSession(OPERATION, "session");
		yield* acknowledgeTurn(OPERATION, RECEIPT);
		const acknowledged = yield* store.load("one");

		const acknowledgement = yield* acknowledgeTurn(OPERATION, { ...RECEIPT, turnId: "wrong" });

		expect(acknowledgement).toMatch(AMBIGUOUS);
		expect(yield* store.load("one")).toEqual(acknowledged);
	},
);

operationStorageStory.it(
	"another writer giving a second record the operation makes its owner ambiguous and refuses its acknowledgement",
	[],
	function* ({ acknowledgeSession, acknowledgeTurn, owner, store }) {
		yield* store.insert(namedRecord("one", [namedAttempt("worker")]));
		const other = yield* store.insert(namedRecord("other", []));
		yield* acknowledgeSession(OPERATION, "session");
		const acknowledged = yield* store.load("one");

		yield* store.compareAndSet("other", other.version, { ...other.value, attempts: [namedAttempt("worker")] });

		yield* outcomes([
			["owner", () => owner(OPERATION), "no single owner"],
			["acknowledgement", () => acknowledgeTurn(OPERATION, RECEIPT), expect.stringMatching(AMBIGUOUS)],
			["owning record", () => store.load("one"), acknowledged],
		]);
	},
);

operationStorageStory.it(
	"an owner whose record changed after the ownership snapshot is not returned",
	[],
	function* ({ ownerAfterRacingChange, store }) {
		yield* store.insert(namedRecord("one", [namedAttempt("worker")]));

		const owner = yield* ownerAfterRacingChange(OPERATION, "one", { prompt: "Changed by another writer" });

		expect(owner).toBe("no single owner");
		expect((yield* store.load("one"))?.value.prompt).toBe("Changed by another writer");
	},
);
