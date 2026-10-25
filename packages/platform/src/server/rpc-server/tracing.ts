import { Cause, Context, Effect, Exit, Layer, Option, Predicate, Random } from "effect";
import { Headers } from "effect/http";
import { KeyScope } from "@shivaedev/effect-contract/serverMetadata.ts";
import { RequestId } from "#rpc/identity.ts";
import { RequestTracing } from "#rpc/middleware.ts";
import { commandChanges } from "#server/commandChanges.ts";
import { redact } from "./redact.ts";
import { redactCause } from "./redactCause.ts";
import { isSensitiveKey, REDACTED, redactText, type SensitiveKey } from "./sensitive.ts";
export interface RequestTracingOptions {
	readonly header?: string;
	readonly sensitive?: SensitiveKey;
}
const ACCEPTED_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
function hex(byte: number): string {
	return byte.toString(16).padStart(2, "0");
}
const generateRequestId = Effect.map(Effect.all(Array.from({ length: 16 }, () => Random.nextIntBetween(0, 255))), (bytes) => bytes.map(hex).join(""));
function requestIdOf(headers: Headers.Headers, header: string): Effect.Effect<string> {
	return Option.match(
		Option.filter(Headers.get(headers, header), (value) => ACCEPTED_REQUEST_ID.test(value)),
		{
			onNone: () => generateRequestId,
			onSome: Effect.succeed,
		},
	);
}
function failureTag(cause: Cause.Cause<unknown>, sensitive: SensitiveKey = isSensitiveKey): string {
	return Option.match(Cause.findErrorOption(cause), {
		onNone: () => "unknown",
		onSome: (error) => {
			if (!(Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag))) {
				return "unknown";
			}
			return sensitive("_tag") ? REDACTED : redactText(error._tag, sensitive);
		},
	});
}
function logFailure(cause: Cause.Cause<unknown>, payload: unknown, sensitive: SensitiveKey | undefined): Effect.Effect<void> {
	if (Cause.hasInterruptsOnly(cause)) {
		return Effect.annotateCurrentSpan("rpc.interrupted", true).pipe(
			Effect.andThen(Effect.logDebug("RPC interrupted")),
			Effect.annotateLogs({ "rpc.payload": redact(payload, sensitive) }),
		);
	}
	const annotations = { "rpc.payload": redact(payload, sensitive) };
	if (!Cause.hasDies(cause)) {
		return Effect.annotateLogs(Effect.logInfo("RPC failure"), { ...annotations, "rpc.failure": failureTag(cause, sensitive) });
	}
	const defects = cause.reasons.filter(Cause.isDieReason).map((reason) => redact(reason.defect, sensitive));
	return Effect.annotateLogs(Effect.logError("RPC defect"), { ...annotations, "rpc.defect": defects });
}
export function requestTracingLayer(options: RequestTracingOptions = {}): Layer.Layer<RequestTracing> {
	return Layer.succeed(RequestTracing, (effect, { headers, payload, rpc }) =>
		Effect.gen(function* () {
			const requestId = yield* requestIdOf(headers, options.header ?? "x-request-id");
			yield* Effect.annotateCurrentSpan({ "request.id": requestId, "rpc.method": rpc._tag });
			const invocation = Option.isSome(Context.getOption(rpc.annotations, KeyScope)) ? effect : commandChanges(effect, rpc, payload);
			return yield* invocation.pipe(
				Effect.catchCauseIf(Cause.hasDies, (cause) => Effect.failCause(redactCause(cause, options.sensitive))),
				Effect.onExit((exit) => (Exit.isFailure(exit) ? logFailure(exit.cause, payload, options.sensitive) : Effect.void)),
				Effect.provideService(RequestId, requestId),
				Effect.annotateLogs({ requestId, "rpc.method": rpc._tag }),
				Effect.withLogSpan("rpc.duration"),
			);
		}),
	);
}
