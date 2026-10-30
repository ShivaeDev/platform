import { inspect } from "node:util";
import { Cause, Context, Effect, Exit, Layer, Logger, ManagedRuntime, Option } from "effect";
import { HttpBody, HttpClient } from "effect/http";
import { OtlpExporter } from "effect/observability";
import type { OtlpSpan } from "@shivaedev/test-story/server/otlpReceiver.ts";
import { otlpHttpClient } from "#otlpHttpClient.ts";
import { ping } from "./ping.ts";
import { type HostState, io, runtimeOf } from "./state.ts";

const SERVER_KIND = 2;
const statusWords = ["unset", "ok", "error"];

function attributeValue(value: unknown): unknown {
	if (typeof value !== "object" || value === null) {
		return value;
	}
	const [entry] = Object.values(value);
	return entry;
}

export function attributesOf(attributes: readonly { readonly key: string; readonly value: unknown }[]) {
	return Object.fromEntries(attributes.map(({ key, value }) => [key, attributeValue(value)]));
}

function serverSpans(state: HostState) {
	return (state.receiver?.spans ?? []).filter((span) => span.kind === SERVER_KIND);
}

function spanWords(span: OtlpSpan) {
	return {
		attributes: attributesOf(span.attributes),
		parentSpanId: span.parentSpanId,
		status: statusWords[span.status.code] ?? `status ${span.status.code}`,
		traceId: span.traceId,
	};
}

export function logWords(entry: HostState["logs"][number]) {
	return {
		annotations: entry.annotations,
		level: entry.level,
		message: Array.isArray(entry.message) ? entry.message.join(" ") : String(entry.message),
	};
}

function reportedError(reason: Cause.Reason<unknown>) {
	if (Cause.isFailReason(reason)) {
		return reason.error;
	}
	return Cause.isDieReason(reason) ? reason.defect : "interrupted";
}

function reasonWords(reason: Cause.Reason<unknown>) {
	if (Cause.isFailReason(reason)) {
		return "failure";
	}
	return Cause.isDieReason(reason) ? "defect" : `interruption by fiber ${String(reason.fiberId)}`;
}

export function traceVerbs(state: HostState, tell: (line: string) => void) {
	return {
		collectorAnswers: (count: number) => {
			tell(`the native OTLP HTTP client posts ${count} exports in a row to the collector`);
			return io(() => collectorAnswers(state, count));
		},
		diagnosticLog: (message: string) =>
			Effect.sync(() => state.logs.find((entry) => logWords(entry).message.includes(message))?.annotations ?? `no log mentioning ${message}`),
		diagnosticLogMentions: (message: string, ...texts: readonly string[]) =>
			Effect.sync(() => {
				const logs = inspect(
					state.logs.filter((entry) => logWords(entry).message.includes(message)),
					{ depth: 20 },
				);
				return texts.filter((text) => logs.includes(text));
			}),
		diagnosticLogs: (message: string) =>
			Effect.sync(() => state.logs.filter((entry) => logWords(entry).message.includes(message)).map(({ annotations }) => annotations)),
		exceptionStack: (name: string) =>
			Effect.sync(() => {
				const exception = (state.receiver?.spans ?? []).find((span) => span.name === name)?.events.find((event) => event.name === "exception");
				const stack = exception === undefined ? undefined : attributesOf(exception.attributes)["exception.stacktrace"];
				return typeof stack === "string" ? stack : `no exception stack on a span named ${name}`;
			}),
		exportContentTypes: () => Effect.sync(() => (state.receiver?.requests ?? []).map(({ contentType }) => contentType)),
		exportedResource: () =>
			Effect.sync(() => {
				const span = (state.receiver?.spans ?? []).find(({ name }) => name === "POST /rpc");
				return span === undefined ? "no POST /rpc span exported" : attributesOf(span.resourceAttributes);
			}),
		exportedSpanNames: () => Effect.sync(() => (state.receiver?.spans ?? []).map(({ name }) => name)),
		exportMentions: (...texts: readonly string[]) =>
			Effect.sync(() => {
				const bodies = (state.receiver?.requests ?? []).map(({ body }) => body).join("\n");
				return texts.filter((text) => bodies.includes(text));
			}),
		exportPaths: () => Effect.sync(() => (state.receiver?.requests ?? []).map(({ path }) => path)),
		exports: () => Effect.sync(() => state.receiver?.requests ?? []),
		exportsMentioning: (text: string) => Effect.sync(() => (state.receiver?.requests ?? []).filter(({ body }) => body.includes(text)).length),
		exportWarnings: () => Effect.sync(() => state.logs.filter(({ level }) => level === "Warn").map(logWords)),
		flushedRequest: () => {
			tell("a traced RPC request is answered and the exporter flushes its batch");
			return io(async () => {
				const runtime = runtimeOf(state);
				await ping(`${state.url}${state.rpcPath}`);
				const context = await runtime.runPromise(Effect.context());
				await runtime.runPromise(Option.getOrThrow(Context.getOption(context, OtlpExporter.Flusher)).flush);
			});
		},
		logMentions: (...secrets: readonly string[]) =>
			Effect.sync(() => {
				const logs = inspect(state.logs, { depth: 20 });
				return secrets.filter((secret) => logs.includes(secret));
			}),
		nativeSpanFailure: (name: string) =>
			Effect.sync(() => {
				const span = state.nativeSpans.find((candidate) => candidate.kind === "server" && candidate.name === name);
				if (span === undefined || span.status._tag !== "Ended") {
					return `no ended server span named ${name}`;
				}
				return Exit.isFailure(span.status.exit)
					? Option.getOrElse(Cause.findErrorOption(span.status.exit.cause), () => "ended without a failure")
					: "succeeded";
			}),
		reportedErrorField: (field: string) =>
			Effect.sync(() =>
				state.reported.map((cause) => {
					const error: unknown = Cause.squash(cause);
					const value: unknown = typeof error === "object" && error !== null ? Reflect.get(error, field) : undefined;
					return `${error instanceof Error ? "an Error" : "a plain value"} whose ${field} is ${String(value)}`;
				}),
			),
		reportedErrors: () => Effect.sync(() => state.reported.flatMap((cause) => cause.reasons.map(reportedError))),
		reportedReasons: () =>
			Effect.sync(() =>
				state.reported.flatMap((cause) =>
					cause.reasons.map((reason) => ({
						annotations: Object.fromEntries(reason.annotations),
						reason: reasonWords(reason),
					})),
				),
			),
		reportMentions: (...texts: readonly string[]) =>
			Effect.sync(() => {
				const reports = state.reported.map((cause) => `${Cause.pretty(cause)}\n${inspect(cause, { depth: 20 })}`).join("\n");
				return texts.filter((text) => reports.includes(text));
			}),
		rpcLogs: (method: string) => Effect.sync(() => state.logs.filter(({ annotations }) => annotations["rpc.method"] === method).map(logWords)),
		serverSpan: (name: string) =>
			Effect.sync(() => {
				const span = serverSpans(state).find((candidate) => candidate.name === name);
				return span === undefined ? `no server span named ${name}` : spanWords(span);
			}),
		serverSpanNames: () =>
			Effect.sync(() =>
				serverSpans(state)
					.filter(({ attributes }) => attributes.some(({ key }) => key === "http.request.method"))
					.map(({ name }) => name)
					.sort(),
			),
		spanAttributes: (name: string) =>
			Effect.sync(() => (state.receiver?.spans ?? []).filter((span) => span.name === name).map((span) => attributesOf(span.attributes))),
	};
}

async function collectorAnswers(state: HostState, count: number) {
	const answers: string[] = [];
	const logger = Logger.make((options) => {
		state.logs.push({ annotations: {}, attempt: state.receiver?.requests.length ?? 0, level: options.logLevel, message: options.message });
	});
	const runtime = ManagedRuntime.make(otlpHttpClient().pipe(Layer.provideMerge(Logger.layer([logger]))));
	try {
		for (let attempt = 0; attempt < count; attempt += 1) {
			const warnings = state.logs.filter(({ level }) => level === "Warn").length;
			const response = await runtime.runPromise(
				Effect.flatMap(HttpClient.HttpClient, (client) =>
					client.post(`${state.receiver?.url ?? ""}/v1/traces`, { body: HttpBody.jsonUnsafe({ resourceSpans: [] }) }),
				),
			);
			const warned = state.logs.filter(({ level }) => level === "Warn").length > warnings;
			answers.push(`${response.status} ${warned ? "warned" : "quiet"}`);
		}
		return answers;
	} finally {
		await runtime.dispose();
	}
}
