import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import type { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import type { WebSocketRequired } from "@shivaedev/contract/WebSocketRequired.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { WaitReading } from "#browser/responses/schema.ts";
import { type ResponseRejection, Unanswered } from "#rpc/rejections.ts";

type ReadFailure = ResponseRejection | RpcClientError | QueryReadDenied | MissingReadPolicy | WebSocketRequired;

function resultFor(reading: WaitReading) {
	if (reading.response) {
		return Effect.succeed({ kind: "response", question: reading.question, response: reading.response } as const);
	}
	if (reading.expired) {
		return Effect.fail(
			new Unanswered({
				message:
					"The human left this unanswered for 48 hours. Check in with them; they may have forgotten or want to postpone. The request and late replies remain available.",
			}),
		);
	}
	return Effect.succeed(undefined);
}

function retryable(error: ReadFailure) {
	return error._tag === "RpcClientError" || error._tag === "ServiceUnavailable" || error._tag === "InternalServerError";
}

export const waitForResponse = Effect.fn("WorkBoard.waitForResponse")(function* (
	read: () => Effect.Effect<WaitReading, ReadFailure>,
	diagnostic: (text: string) => void,
) {
	let known: WaitReading | undefined;
	const leaseEnd = (yield* Clock.currentTimeMillis) + 48 * 60 * 60 * 1000;
	let unavailable = false;
	while (true) {
		const result = yield* read().pipe(Effect.result);
		if (result._tag === "Failure") {
			if (!retryable(result.failure)) {
				return yield* Effect.fail(result.failure);
			}
			if ((yield* Clock.currentTimeMillis) >= (known?.question.question.deadline ?? leaseEnd)) {
				return yield* Effect.fail(
					new ServiceUnavailable({
						message: "The service is unavailable at the deadline; unanswered status could not be verified. Re-read this question when it returns.",
					}),
				);
			}
			if (!unavailable) {
				diagnostic("Local service unavailable; reconnecting to the same question.");
			}
			unavailable = true;
			yield* Effect.sleep("2 seconds");
			continue;
		}
		known = result.success;
		unavailable = false;
		const complete = yield* resultFor(known);
		if (complete) {
			return complete;
		}
	}
});
