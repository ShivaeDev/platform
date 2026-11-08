import { Cause, Effect, Option } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { causeWords } from "@shivaedev/test-story/server/answers.ts";
import { adminVerbs } from "#test/app-host/adminVerbs.ts";
import { applicationClockVerbs } from "#test/app-host/applicationClockVerbs.ts";
import { browserErrorReadouts } from "#test/app-host/browserErrorReadouts.ts";
import { clientAbortVerbs } from "#test/app-host/clientAbortVerbs.ts";
import { connectionSecurity, serverOffersTls } from "#test/app-host/connectionSecurity.ts";
import { databaseVerbs } from "#test/app-host/databaseVerbs.ts";
import { fieldScopeVerbs } from "#test/app-host/fieldScopeVerbs.ts";
import { close, hasService } from "#test/app-host/lifecycle.ts";
import { receiveMaskedFailure } from "#test/app-host/maskedFailureApi.ts";
import { requestLoggingVerbs } from "#test/app-host/requestLoggingVerbs.ts";
import { requests } from "#test/app-host/requests.ts";
import { runtimeVerbs } from "#test/app-host/runtime.ts";
import type { HostState } from "#test/app-host/state.ts";
import { subscriptionVerbs } from "#test/app-host/subscription.ts";
import { timeoutVerbs } from "#test/app-host/timeoutVerbs.ts";
import { traceVerbs } from "#test/app-host/traceVerbs.ts";
import { wireAnswers } from "#test/app-host/wireAnswers.ts";

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
		...applicationClockVerbs(state, story.tell),
		...browserErrorReadouts(state),
		connectionSecurity: () => connectionSecurity(state),
		serverOffersTls: () => serverOffersTls(state),
		...requests(state, story.tell),
		...requestLoggingVerbs(state, story.tell),
		receiveMaskedFailure: (interrupt: boolean) => {
			story.tell("the native RPC client requests a declared failure with sensitive fields");
			return receiveMaskedFailure(state.url, interrupt);
		},
		receiveMaskedNull: () => {
			story.tell("the native RPC client requests a declared null failure");
			return receiveMaskedFailure(state.url, false, "null");
		},
		receiveMaskedStream: (interrupt: boolean) => {
			story.tell("the native RPC client consumes a stream with a declared sensitive failure");
			return receiveMaskedFailure(state.url, interrupt, "stream");
		},
		...clientAbortVerbs(state, story.tell),
		...databaseVerbs(state, story.tell),
		...fieldScopeVerbs(state, story.tell),
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
