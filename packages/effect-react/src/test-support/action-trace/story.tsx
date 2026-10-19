import { Config, Effect, Layer, Option, Redacted, Tracer } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { makePostgresTestLayer } from "@shivaedev/effect-test-sql/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { clickButton, Screen } from "#test/Screen.ts";
import { connect } from "./connect.ts";
import { Jobs, migrations, Work } from "./feature.ts";
import { openHost } from "./openHost.ts";
import { Action, Create, Editor } from "./view.tsx";

const configured = Effect.runSync(Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL").pipe(Config.option));
export const actions = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const spans: Tracer.Span[] = [];
		const tracer = Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);
				spans.push(span);
				return span;
			},
		});
		const host = yield* openHost(tracer);
		return { ...host, client: connect(host.url), screen: new Screen(() => undefined), spans, tracer };
	},
	inspect: ({ headers, spans }) => ({ headers, spans: spans.map(({ name, traceId }) => ({ name, traceId })) }),
	layer: makePostgresTestLayer({ migrations, url: Option.getOrElse(configured, () => Redacted.make("postgresql://disabled")) }),
	name: "action traces over HTTP and PostgreSQL",
	runIf: Option.isSome(configured),
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.screen.tell = story.tell;
		function view() {
			const rendered = engine.screen.roots[0];
			if (!rendered) {
				throw new Error("Missing action screen");
			}
			return rendered.container;
		}
		return {
			click: () => engine.screen.act("click Write", () => clickButton(view(), "Write")),
			headers: () => engine.headers,
			observe: (line: string, check: () => void) => engine.screen.observe(line, check),
			ready: () => view().querySelector("button")?.disabled === false,
			spans: () => engine.spans.filter((span) => span.status._tag === "Ended"),
			stored: engine.stored,
			work: () =>
				Effect.gen(function* () {
					story.tell("a separate worker consumes the durable jobs");
					const database = yield* PostgresTestDatabase;
					yield* Layer.build(
						Jobs.layer({
							connectionString: Redacted.value(database.url),
							jobs: [Work.handle(() => Effect.void)],
						}).pipe(Layer.provide(Layer.succeed(Tracer.Tracer, engine.tracer))),
					);
				}),
		};
	},
});
export function screen(mode: "action" | "create" | "editor") {
	return actions.trait("screen", `a rendered ${mode}`, function* (engine) {
		const View = { action: Action, create: Create, editor: Editor }[mode];
		yield* engine.screen.open(<View client={engine.client} />);
	});
}
