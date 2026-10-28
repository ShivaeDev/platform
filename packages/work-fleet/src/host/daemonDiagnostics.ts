import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { HealthSnapshot } from "#engine/health.ts";
import { Fleet } from "#fleet.ts";
import { fleetItems } from "#host/fleetItems.ts";

const { codexLimits, DiagnosticsContract, DiagnosticsSources, diagnostics, githubLimits } = diagnosticsApi;

interface Brief {
	readonly sourcePath: string;
	readonly workId: string;
}

// One read pass shares a single Board scan across every brief a Board view asks about.
function briefRefusals(engine: typeof Fleet.Service, briefs: readonly Brief[]) {
	return withBoardReadPass(
		Effect.forEach(briefs, (brief) =>
			engine.briefProblem(brief.workId, brief.sourcePath).pipe(
				Effect.map((message) => (message === undefined ? [] : [{ ...brief, message }])),
				Effect.catch(() => Effect.succeed([])),
			),
		),
	).pipe(Effect.map((refusals) => refusals.flat()));
}

export const daemonDiagnostics = Effect.gen(function* () {
	const provided = yield* Effect.serviceOption(DiagnosticsSources);
	const fleet = yield* HealthSnapshot;
	const sources = {
		codex: provided._tag === "Some" ? provided.value.codex : codexLimits(),
		fleet,
		github: githubLimits(fleet),
	};
	const read = yield* diagnostics(sources);
	const items = yield* fleetItems;
	const engine = yield* Effect.serviceOption(Fleet);
	return DiagnosticsContract.application.toLayer(
		Effect.succeed(
			DiagnosticsContract.application.of({
				"daemon.briefProblems": ({ briefs }) =>
					engine._tag === "Some"
						? briefRefusals(engine.value, briefs)
						: Effect.fail(new ServiceUnavailable({ message: "Fleet brief validation is unavailable" })),
				"daemon.diagnostics": () => read,
				"daemon.fleetItems": () => items.pipe(Effect.mapError((error) => new ServiceUnavailable({ message: failureMessage(error) }))),
			}),
		),
	);
});
