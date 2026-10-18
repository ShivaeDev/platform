import { Option } from "effect";
import { expect } from "vitest";
import { lockStory, referenceLock } from "#test/kit.ts";

lockStory.it("a holder's field order does not change the published protocol bytes", [], function* ({ protocol, lock }) {
	expect(yield* protocol.publishReference()).toEqual(Option.none());
	const first = lock.contents();
	expect(first).toBe(protocol.reference);
	yield* lock.release(protocol.referenceHolder.id);
	const { startedAtMs, ...otherFields } = protocol.referenceHolder;
	expect(yield* protocol.publishReference({ startedAtMs, ...otherFields })).toEqual(Option.none());
	expect(lock.contents()).toBe(first);
	expect(yield* lock.read()).toEqual(Option.some(protocol.referenceHolder));
});

lockStory.it("a reference-format lock naming a live process blocks acquisition", [referenceLock()], function* ({ lock, protocol }) {
	const before = lock.contents();
	expect(Option.map(yield* lock.acquire("waiter"), ({ id }) => id)).toEqual(Option.some(protocol.referenceHolder.id));
	expect(lock.contents()).toBe(before);
});

lockStory.it("an acquired lock follows the protocol's key order and format", [], function* ({ run, protocol, lock }) {
	const command = yield* run.start();
	yield* run.environment(command);
	const recorded = lock.contents();
	const parsed: unknown = JSON.parse(recorded ?? "");
	expect(Object.keys(parsed ?? {})).toEqual(["id", "pid", "processStartedAt", "command", "cwd", "startedAtMs"]);
	expect(recorded).toMatch(/^\{"id":"[\w-]+","pid":\d+,"processStartedAt":"[^"]+","command":"pnpm ready","cwd":"[^"]+","startedAtMs":\d+\}$/u);
	expect(parsed).toMatchObject(protocol.processIdentity());
	yield* run.complete(command);
	yield* run.join(command);
	expect(lock.contents()).toBeUndefined();
});
