import { Config, Effect, Layer, Option, Redacted, Schema, Tracer } from "effect";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton, Screen } from "#test/Screen.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { connect } from "./connect.ts";
import { Jobs, migrations, Work } from "./feature.ts";
import { openHost } from "./openHost.ts";
import { Action, Create, Editor } from "./view.tsx";

const StoredJobs = Schema.Array(
	Schema.Struct({ payload: Schema.Struct({ id: Schema.Number }), span: Schema.Struct({ spanId: Schema.String, traceId: Schema.String }) }),
);

function recordingTracer() {
	const spans: Tracer.Span[] = [];
	const listeners = new Set<() => void>();
	class RecordingSpan extends Tracer.NativeSpan {
		override end(endTime: bigint, exit: Parameters<Tracer.NativeSpan["end"]>[1]) {
			super.end(endTime, exit);
			for (const listener of [...listeners]) {
				listener();
			}
		}
	}
	const tracer = Tracer.make({
		span: (options) => {
			const span = new RecordingSpan(options);
			spans.push(span);
			return span;
		},
	});
	function ended(name: string) {
		return spans.filter((span) => span.name === name && span.status._tag === "Ended");
	}
	function until(done: () => boolean) {
		return Effect.callback<void>((resume) => {
			function check() {
				if (done()) {
					listeners.delete(check);
					resume(Effect.void);
				}
			}
			listeners.add(check);
			check();
			return Effect.sync(() => listeners.delete(check));
		});
	}
	return { ended, spans, tracer, until };
}

interface Writer {
	readonly ended: ReturnType<typeof recordingTracer>["ended"];
	readonly headers: readonly string[];
	readonly screen: Screen;
	readonly until: ReturnType<typeof recordingTracer>["until"];
}

function writeButton(engine: Writer) {
	const view = engine.screen.roots[0];
	if (!view) {
		throw new Error("Missing action screen");
	}
	return view.container;
}

function settleWrite(engine: Writer) {
	const container = writeButton(engine);
	return settleScreen(container, () => container.querySelector("button")?.disabled !== false, engine.screen.tell);
}

function clickWrite(engine: Writer) {
	const writes = engine.headers.length + 2;
	return engine.screen
		.act("click Write", () => clickButton(writeButton(engine), "Write"))
		.pipe(
			Effect.andThen(settleWrite(engine)),
			Effect.andThen(engine.until(() => engine.ended("write").filter(({ kind }) => kind === "server").length >= writes)),
		);
}

const configured = Effect.runSync(Config.Redacted("PLATFORM_SQL_TEST_DATABASE_URL").pipe(Config.option));

export const actions = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const recording = recordingTracer();
		const host = yield* openHost(recording.tracer);
		return { ...host, ...recording, client: connect(host.url), screen: new Screen(() => undefined) };
	},
	inspect: ({ headers, spans }) => ({ headers, spans: spans.map(({ name, traceId }) => ({ name, traceId })) }),
	layer: makePostgresTestLayer({ migrations, url: Option.getOrElse(configured, () => Redacted.make("postgresql://disabled")) }),
	name: "action traces over HTTP and PostgreSQL",
	runIf: Option.isSome(configured),
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.screen.tell = story.tell;
		function traceName(traceId: string) {
			const clicks = [...new Set(engine.headers.map((header) => header.split("-")[1]))];
			const index = clicks.indexOf(traceId);
			return index === -1 ? "another trace" : `trace ${index + 1}`;
		}
		function inTrace(trace: string, name: string, kind?: Tracer.SpanKind) {
			return engine.ended(name).filter((span) => traceName(span.traceId) === trace && (kind === undefined || span.kind === kind));
		}
		const storedJobs = engine.stored().pipe(Effect.map((jobs) => Schema.decodeUnknownSync(StoredJobs)(jobs)));
		return {
			click: () => clickWrite(engine),
			rpcTraces: () =>
				Effect.sync(() =>
					engine.headers.map((header) =>
						/^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/u.test(header) ? traceName(header.split("-")[1] ?? "") : `malformed ${header}`,
					),
				),
			storedJobs: () =>
				Effect.map(storedJobs, (jobs) =>
					jobs.map(({ payload, span }) => ({
						id: payload.id,
						span: inTrace(traceName(span.traceId), "Action.enqueue").some(({ spanId }) => spanId === span.spanId)
							? "its enqueue span"
							: "an unknown span",
						trace: traceName(span.traceId),
					})),
				),
			traceSpans: (trace: string) =>
				Effect.sync(() => ({
					enqueues: inTrace(trace, "Action.enqueue").length,
					"SQL queries": inTrace(trace, "postgres").length,
					"server RPCs": inTrace(trace, "write", "server").length,
					"server RPCs with a request id and a parent": inTrace(trace, "write", "server").filter(
						(span) => /^[a-f0-9]{32}$/u.test(String(span.attributes.get("request.id"))) && Option.isSome(span.parent),
					).length,
				})),
			workerAttempts: () =>
				Effect.map(storedJobs, (jobs) =>
					jobs.map(({ payload, span }) => {
						const attempt = engine
							.ended("action-work")
							.find(({ links }) => links.some((link) => link.span.spanId === span.spanId && link.span.traceId === span.traceId));
						return { id: payload.id, trace: attempt === undefined ? "no attempt" : traceName(attempt.traceId) };
					}),
				),
			workerRuns: () =>
				Effect.gen(function* () {
					story.tell("a separate worker consumes the durable jobs");
					const database = yield* PostgresTestDatabase;
					const jobs = (yield* storedJobs).length;
					yield* Layer.build(
						Jobs.layer({ jobs: [Work.handle(() => Effect.void)] })
							.pipe(Layer.provide(pgBossLayer({ connectionString: database.url })))
							.pipe(Layer.provide(Layer.succeed(Tracer.Tracer, engine.tracer))),
					);
					yield* engine.until(() => engine.ended("action-work").length >= jobs);
				}),
		};
	},
});

type Mode = "action" | "create" | "editor";

function* open(engine: Writer & { readonly client: ReturnType<typeof connect> }, mode: Mode) {
	const View = { action: Action, create: Create, editor: Editor }[mode];
	yield* engine.screen.open(<View client={engine.client} />);
	yield* settleWrite(engine);
}

export function writeScreen(mode: Mode) {
	return actions.trait("screen", `a ${mode} screen whose Write makes two RPCs that insert and enqueue`, (engine) => open(engine, mode));
}

export function writeClicked(mode: Mode) {
	return actions.trait("screen", `Write on the ${mode} screen was clicked once`, function* (engine) {
		yield* open(engine, mode);
		yield* clickWrite(engine);
	});
}
