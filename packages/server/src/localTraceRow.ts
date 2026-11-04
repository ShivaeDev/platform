import { Cause, Exit, Option, type Tracer } from "effect";
import { redactRecord } from "@shivaedev/errors/redact.ts";
import { redactText } from "@shivaedev/errors/sensitive.ts";
import { type HostRedactionPolicy, redactionForRpc } from "#RedactionPolicy.ts";

export function localTraceRow(span: Tracer.NativeSpan, policy: HostRedactionPolicy) {
	if (span.status._tag !== "Ended" || !span.sampled) {
		return undefined;
	}
	const sensitive = redactionForRpc(policy, span.attributes.get("rpc.method"));
	const { startTime, endTime, exit } = span.status;
	const attributes = redactRecord(Object.fromEntries(span.attributes), sensitive);
	const failedStatus = Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause) ? "interrupted" : "failure";
	return {
		attributes,
		durationNanos: String(endTime - startTime),
		endedAtMillis: Number.parseInt(String(endTime / 1_000_000n), 10),
		error: Exit.isFailure(exit) ? redactText(Cause.pretty(exit.cause), sensitive) : null,
		events: span.events.map(([name, time, values]) => ({
			attributes: redactRecord(values, sensitive),
			name: redactText(name, sensitive),
			time: String(time),
		})),
		kind: span.kind,
		links: span.links.map(({ span: linked, attributes: values }) => ({
			attributes: redactRecord(values, sensitive),
			spanId: linked.spanId,
			traceId: linked.traceId,
		})),
		name: redactText(span.name, sensitive),
		parentSpanId: Option.getOrUndefined(span.parent)?.spanId ?? null,
		spanId: span.spanId,
		startedAtMillis: Number.parseInt(String(startTime / 1_000_000n), 10),
		status: Exit.isSuccess(exit) ? "success" : failedStatus,
		traceId: span.traceId,
	};
}

export type LocalTraceRow = NonNullable<ReturnType<typeof localTraceRow>>;

export function traceJson(value: unknown): string {
	return JSON.stringify(value, (_key, nested: unknown) => (typeof nested === "bigint" ? String(nested) : nested));
}
