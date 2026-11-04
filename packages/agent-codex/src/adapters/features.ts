import type { Scope } from "effect";
import { Effect } from "effect";
import type { ConfiguredFeatures, FeatureImplementations } from "@shivaedev/agent/backend.ts";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import { Rejected } from "@shivaedev/agent/failures.ts";
import type { ImageInput, Receipt, StartRequest } from "@shivaedev/agent/run.ts";
import { ModelListResponse } from "#adapters/protocol.ts";
import { decode, readRequest, transcript } from "#adapters/reads.ts";
import { AppServer } from "#adapters/server.ts";
import type { Session } from "#adapters/session.ts";
export const features = Effect.fn("Codex.features")(function* (
	sessions: Map<string, Session>,
	start: (
		request: Omit<StartRequest, "input"> & { readonly input: ImageInput },
		session?: { value: string; version: number },
	) => Effect.Effect<Receipt, BackendFailure, Scope.Scope>,
) {
	const server = yield* AppServer;
	function driverFor(receipt: Receipt) {
		return Effect.suspend(() => {
			const session = sessions.get(receipt.session?.value ?? "");
			return session === undefined
				? Effect.fail(new Rejected({ backend: "codex", message: "No live session for this receipt" }))
				: Effect.succeed(session.driver);
		});
	}
	const models: FeatureImplementations["models"] = {
		list: readRequest("model/list", {}).pipe(
			Effect.flatMap((value) => decode(ModelListResponse, value)),
			Effect.map(({ data }) =>
				data.map((model) => ({
					defaultEffort: model.defaultReasoningEffort,
					efforts: model.supportedReasoningEfforts.map((effort) => effort.reasoningEffort),
					id: model.model,
					isDefault: model.isDefault,
					name: model.displayName,
				})),
			),
			Effect.provideService(AppServer, server),
		),
	};
	return {
		imageInput: { implementation: { start }, support: "supported" },
		interruption: {
			implementation: { interrupt: (receipt) => driverFor(receipt).pipe(Effect.flatMap((driver) => driver.interrupt(receipt.reference.value))) },
			support: "supported",
		},
		models: { implementation: models, support: "supported" },
		queuedInput: {
			implementation: { queue: (receipt, input) => driverFor(receipt).pipe(Effect.flatMap((driver) => driver.queue(input))) },
			support: "supported",
		},
		sessions: { implementation: { resume: (session, request) => start(request, session) }, support: "supported" },
		steering: {
			implementation: {
				steer: (receipt, input) => driverFor(receipt).pipe(Effect.flatMap((driver) => driver.steer(receipt.reference.value, input))),
			},
			support: "supported",
		},
		transcript: { implementation: { read: (receipt) => transcript(receipt).pipe(Effect.provideService(AppServer, server)) }, support: "supported" },
	} satisfies ConfiguredFeatures;
});
