import { Effect, Schema, Stream } from "effect";
import type { ConfiguredBackend, ConfiguredFeatures, FeatureImplementation, FeatureImplementations } from "#backend.ts";
import { RunEvent } from "#events.ts";
import { BackendUnavailable, UnknownAcceptance } from "#failures.ts";
import type { Feature } from "#features.ts";
import type { Observation, Receipt, Reconciliation, StartRequest } from "#run.ts";

export function scriptedBackend() {
	const calls: { method: string; argument: unknown }[] = [];
	const accepted = new Map<string, Receipt>();
	const supported = new Set<Feature>();
	const script: {
		acceptance: "acknowledged" | "unknown";
		observation: Observation;
		readUnavailable: boolean;
		events: unknown[];
		proof: string | undefined;
	} = {
		acceptance: "acknowledged",
		events: [],
		observation: { state: "running", type: "known" },
		proof: undefined,
		readUnavailable: false,
	};
	function record(method: string, argument: unknown) {
		return Effect.sync(() => {
			calls.push({ argument, method });
		});
	}
	const start = Effect.fnUntraced(function* (request: StartRequest) {
		yield* record("start", request);
		const receipt: Receipt = {
			backend: "scripted",
			operationId: request.operationId,
			reference: { value: `run:${request.operationId}`, version: 1 },
		};
		accepted.set(request.operationId, receipt);
		if (script.acceptance === "unknown") {
			return yield* Effect.fail(
				new UnknownAcceptance({ backend: "scripted", message: "acknowledgement lost", operationId: request.operationId, providerCode: "LOST_ACK" }),
			);
		}
		return receipt;
	});
	function feature<TFeature extends Feature>(
		key: TFeature,
		implementation: FeatureImplementations[TFeature],
	): FeatureImplementation<FeatureImplementations[TFeature]> {
		return supported.has(key) ? { implementation, support: "supported" } : { reason: `script has no ${key}`, support: "unsupported" };
	}
	function features(): ConfiguredFeatures {
		return {
			imageInput: feature("imageInput", {
				start: (request) =>
					record("imageInput", request).pipe(
						Effect.as({ backend: "scripted", operationId: request.operationId, reference: { value: request.operationId, version: 1 } }),
					),
			}),
			interruption: feature("interruption", { interrupt: (receipt) => record("interrupt", receipt) }),
			models: feature("models", { list: record("models", undefined).pipe(Effect.as([])) }),
			queuedInput: feature("queuedInput", { queue: (receipt, input) => record("queue", { input, receipt }) }),
			sessions: feature("sessions", { resume: (session, request) => record("resume", session).pipe(Effect.andThen(start(request))) }),
			steering: feature("steering", { steer: (receipt, input) => record("steer", { input, receipt }) }),
			transcript: feature("transcript", {
				read: (receipt) => record("transcript", receipt).pipe(Effect.as({ completeness: "partial", events: [] })),
			}),
		};
	}
	const backend: ConfiguredBackend = {
		backend: "scripted",
		events: (receipt) =>
			Stream.fromEffect(record("events", receipt)).pipe(
				Stream.flatMap(() => Stream.fromIterable(script.events)),
				Stream.mapEffect((event) => Schema.decodeUnknownEffect(RunEvent)(event).pipe(Effect.orDie)),
			),
		get features() {
			return features();
		},
		inspect: (receipt) =>
			record("inspect", receipt).pipe(
				Effect.andThen(() =>
					script.readUnavailable
						? Effect.fail(new BackendUnavailable({ backend: "scripted", message: "read unavailable", providerCode: "OFFLINE" }))
						: Effect.succeed(script.observation),
				),
			),
		reconcile: (operationId) =>
			record("reconcile", operationId).pipe(
				Effect.map((): Reconciliation => {
					if (script.proof !== undefined) {
						return { evidence: script.proof, operationId, type: "not-accepted" };
					}
					const receipt = accepted.get(operationId);
					return receipt !== undefined && script.acceptance !== "unknown"
						? { receipt, type: "accepted" }
						: { operationId, reason: "no authoritative acceptance evidence", type: "uncertain" };
				}),
			),
		start,
	};
	return { backend, calls, script, supported };
}
export type ScriptedBackend = ReturnType<typeof scriptedBackend>;
