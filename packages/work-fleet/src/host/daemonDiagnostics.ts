import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { diagnostics as diagnosticsApi } from "@shivaedev/work-board/server/integration/diagnostics.ts";
import { failureMessage } from "#engine/failureMessage.ts";
import { HealthSnapshot } from "#engine/health.ts";
import { Fleet } from "#fleet.ts";
import { fleetItems } from "#host/fleetItems.ts";

const { codexLimits, DiagnosticsContract, DiagnosticsSources, diagnostics, githubLimits } = diagnosticsApi;

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
				"daemon.briefProblem": ({ workId, sourcePath }) =>
					(engine._tag === "Some"
						? engine.value.briefProblem(workId, sourcePath)
						: Effect.fail(new ServiceUnavailable({ message: "Fleet brief validation is unavailable" }))
					).pipe(
						Effect.map((message) => message ?? null),
						Effect.mapError((error) => new ServiceUnavailable({ message: failureMessage(error) })),
					),
				"daemon.diagnostics": () => read,
				"daemon.fleetItems": () => items.pipe(Effect.mapError((error) => new ServiceUnavailable({ message: failureMessage(error) }))),
			}),
		),
	);
});
