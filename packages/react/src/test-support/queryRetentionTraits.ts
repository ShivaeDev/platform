import type { Effect } from "effect";
import type { QueryOptions } from "#client/resultState.ts";
import { openProbe } from "./queryState.ts";
import { queryStories } from "./queryStories.ts";
import { queryVerbs } from "./queryVerbs.ts";

export function retention(options: QueryOptions) {
	return options.keepPreviousData === undefined ? "default retention" : `keepPreviousData ${options.keepPreviousData}`;
}

export function queryAnswered(answer: string, options: QueryOptions = {}) {
	return queryStories.trait("screen", `a query with ${retention(options)} showed its first read's answer ${answer}`, function* (engine) {
		yield* openProbe(engine, options);
		yield* queryVerbs(engine.state, engine.screen).answer("first", answer);
	});
}

type Verbs = ReturnType<typeof queryVerbs>;
type Steps = (verbs: Verbs) => Generator<Effect.Effect<unknown, unknown, never>, void>;

function queryAfter(line: string, options: QueryOptions, steps: Steps) {
	return queryStories.trait("screen", line, function* (engine) {
		yield* openProbe(engine, options);
		yield* steps(queryVerbs(engine.state, engine.screen));
	});
}

const kept = { keepPreviousData: true };

function* firstThenSecond(verbs: Verbs, options?: QueryOptions) {
	yield* verbs.answer("first", "First payload");
	yield* verbs.changePayload("second", options);
}

export function payloadChanging(options: QueryOptions = kept) {
	return queryAfter(`a query with ${retention(options)} answered First payload and changed to payload second`, options, (verbs) =>
		firstThenSecond(verbs),
	);
}

export function keptPayloadRefreshing() {
	return queryAfter(
		"a query with keepPreviousData true answered First payload, payload second failed and its refresh waits",
		kept,
		function* (verbs) {
			yield* firstThenSecond(verbs);
			yield* verbs.fail("second", "New payload unavailable");
			yield* verbs.refresh();
		},
	);
}

export function refreshSupersededByPayload() {
	return queryAfter(
		"a query with keepPreviousData true answered First payload, then payload third superseded the waiting refresh of payload second",
		kept,
		function* (verbs) {
			yield* firstThenSecond(verbs);
			yield* verbs.fail("second", "New payload unavailable");
			yield* verbs.refresh();
			yield* verbs.changePayload("third");
		},
	);
}

export function retentionTurnedOff() {
	return queryAfter(
		"a query with keepPreviousData true answered First payload, changed to payload second, then turned keepPreviousData off",
		kept,
		function* (verbs) {
			yield* firstThenSecond(verbs);
			yield* verbs.turnOffRetention();
		},
	);
}

export function invalidatedOnce() {
	return queryAfter("a query answered Last success and an invalidation started a re-read", {}, function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.invalidate("first invalidation");
	});
}

export function invalidatedTwice() {
	return queryAfter("a query answered Last success, then a second invalidation superseded the first one's re-read", {}, function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.invalidate("first invalidation");
		yield* verbs.invalidate("second invalidation");
	});
}

export function refreshFailed() {
	return queryAfter("a query answered Last success and its refresh failed as Unavailable: Offline", {}, function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.refresh();
		yield* verbs.fail("refresh", "Offline");
	});
}

export function retryingAfterFailedRefresh() {
	return queryAfter("a query answered Last success, its refresh failed as Unavailable: Offline and a retry waits", {}, function* (verbs) {
		yield* verbs.answer("first", "Last success");
		yield* verbs.refresh();
		yield* verbs.fail("refresh", "Offline");
		yield* verbs.refresh("retry");
	});
}
