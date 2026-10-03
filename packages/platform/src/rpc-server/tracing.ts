import { Cause, Effect, Layer, Option, Predicate, Random } from "effect";
import { Headers } from "effect/unstable/http";
import { RequestId } from "../rpc/identity.ts";
import { RequestTracing } from "../rpc/middleware.ts";
import { redact } from "./redact.ts";
import { redactCause } from "./redact-cause.ts";
import type { SensitiveKey } from "./sensitive.ts";

export interface RequestTracingOptions {
	readonly header?: string;
	readonly sensitive?: SensitiveKey;
}

const ACCEPTED_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

const hex = (byte: number): string => byte.toString(16).padStart(2, "0");

const generateRequestId = Effect.map(Effect.all(Array.from({ length: 16 }, () => Random.nextIntBetween(0, 255))), (bytes) => bytes.map(hex).join(""));

const requestIdOf = (headers: Headers.Headers, header: string): Effect.Effect<string> =>
	Option.match(
		Option.filter(Headers.get(headers, header), (value) => ACCEPTED_REQUEST_ID.test(value)),
		{
			onNone: () => generateRequestId,
			onSome: Effect.succeed,
		},
	);

const failureTag = (cause: Cause.Cause<unknown>): string =>
	Option.match(Cause.findErrorOption(cause), {
		onNone: () => "unknown",
		onSome: (error) => (Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag) ? error._tag : "unknown"),
	});

const logFailure = (cause: Cause.Cause<unknown>, payload: unknown, sensitive: SensitiveKey | undefined): Effect.Effect<void> => {
	if (Cause.hasInterruptsOnly(cause)) return Effect.void;
	const annotations = { "rpc.payload": redact(payload, sensitive) };
	if (!Cause.hasDies(cause)) return Effect.annotateLogs(Effect.logInfo("RPC failure"), { ...annotations, "rpc.failure": failureTag(cause) });
	const defects = cause.reasons.filter(Cause.isDieReason).map((reason) => redact(reason.defect, sensitive));
	return Effect.annotateLogs(Effect.logError("RPC defect"), { ...annotations, "rpc.defect": defects });
};

export const requestTracingLayer = (options: RequestTracingOptions = {}): Layer.Layer<RequestTracing> =>
	Layer.succeed(RequestTracing, (effect, { headers, payload, rpc }) =>
		Effect.gen(function* () {
			const requestId = yield* requestIdOf(headers, options.header ?? "x-request-id");
			yield* Effect.annotateCurrentSpan({ "request.id": requestId, "rpc.method": rpc._tag });
			return yield* effect.pipe(
				Effect.catchCauseIf(Cause.hasDies, (cause) => Effect.failCause(redactCause(cause, options.sensitive))),
				Effect.tapCause((cause) => logFailure(cause, payload, options.sensitive)),
				Effect.provideService(RequestId, requestId),
				Effect.annotateLogs({ requestId, "rpc.method": rpc._tag }),
				Effect.withLogSpan("rpc.duration"),
			);
		}),
	);
