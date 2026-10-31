import { Cause, Effect, Option } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { causeWords } from "@shivaedev/test/answers.ts";
import { adminVerbs } from "./adminVerbs.ts";
import { clientAbortVerbs } from "./clientAbortVerbs.ts";
import { connectionSecurity, serverOffersTls } from "./connectionSecurity.ts";
import { databaseVerbs } from "./databaseVerbs.ts";
import { close, hasService } from "./lifecycle.ts";
import { requests } from "./requests.ts";
import { runtimeVerbs } from "./runtime.ts";
import type { HostState } from "./state.ts";
import { subscriptionVerbs } from "./subscription.ts";
import { timeoutVerbs } from "./timeoutVerbs.ts";
import { traceVerbs } from "./traceVerbs.ts";
import { wireAnswers } from "./wireAnswers.ts";

function statusKind(status: number) {
	if (status >= HttpStatus.fromLiteral("InternalServerError")) {
		return "server error";
	}
	if (status >= HttpStatus.fromLiteral("BadRequest")) {
		return "client error";
	}
	return status >= HttpStatus.fromLiteral("OK") && status < HttpStatus.fromLiteral("MultipleChoices") ? "success" : `status ${status}`;
}

export function hostVerbs(state: HostState, story: { tell: (line: string) => void }) {
	return {
		...adminVerbs(state, story.tell),
		connectionSecurity: () => connectionSecurity(state),
		serverOffersTls,
		...requests(state, story.tell),
		...clientAbortVerbs(state, story.tell),
		...databaseVerbs(state, story.tell),
		...runtimeVerbs(state, story.tell),
		...traceVerbs(state, story.tell),
		...timeoutVerbs(state, story.tell),
		...subscriptionVerbs(state, story.tell),
		answerMentions: (...texts: readonly string[]) => Effect.sync(() => texts.filter((text) => (state.response?.body ?? "").includes(text))),
		bindAddress: () => Effect.sync(() => state.bindAddress),
		close: () => {
			story.tell("the app host shuts down");
			return close(state);
		},
		databaseGoesDown: () => {
			story.tell("PostgreSQL becomes unreachable");
			return Effect.sync(() => state.proxy?.setReachable(false));
		},
		databaseRecovers: () => {
			story.tell("PostgreSQL becomes reachable again");
			return Effect.sync(() => state.proxy?.setReachable(true));
		},
		databaseStopsAnswering: () => {
			story.tell("PostgreSQL keeps its connections open but stops answering");
			return Effect.sync(() => state.proxy?.setResponsive(false));
		},
		handledCalls: () => Effect.sync(() => [...state.calls]),
		provided: <TIdentifier, TService>(service: Parameters<typeof hasService<TIdentifier, TService>>[1]) =>
			Effect.map(hasService(state, service), (present) => (present ? "provided" : "missing")),
		responseCacheControl: () => Effect.sync(() => (state.response === undefined ? "no response yet" : state.response.cacheControl)),
		responseKind: () => Effect.sync(() => (state.response === undefined ? "no response yet" : statusKind(state.response.status))),
		responseStatus: () => Effect.sync(() => state.response?.status ?? "no response yet"),
		runtimeLifecycle: () => Effect.sync(() => [...state.runtimeLifecycle]),
		serviceLifecycle: () => Effect.sync(() => [...state.lifecycle]),
		sessionLookups: () => Effect.sync(() => [...state.lookups]),
		startup: () => Effect.sync(() => (state.bootFailure === undefined ? "listening" : causeWords(state.bootFailure))),
		startupFailureMessage: () =>
			Effect.sync(() =>
				Option.match(Cause.findErrorOption(state.bootFailure ?? Cause.empty), {
					onNone: () => "startup did not fail",
					onSome: (error) => (error instanceof Error ? error.message : String(error)),
				}),
			),
		wireAnswers: () => Effect.sync(() => wireAnswers(state.response?.body ?? "")),
	};
}
