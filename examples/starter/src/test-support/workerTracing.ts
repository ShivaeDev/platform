import { Effect, Exit, Scope } from "effect";
import { expect, vi } from "vitest";
import { otlpReceiver } from "@shivaedev/test-story/otlpReceiver.ts";

export function workerTracing<E, R>(tell: (line: string) => void, startWorker: (env: Record<string, string>) => Effect.Effect<void, E, R>) {
	return {
		collector: Effect.fn("AppStory.collector")(function* (status?: number | "down") {
			tell(`start a collector that ${status === "down" ? "is down" : `returns HTTP ${status ?? 200}`}`);
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
			const receiver = yield* otlpReceiver({ status: typeof status === "number" ? status : 200 }).pipe(Scope.provide(scope));
			if (status === "down") {
				yield* Scope.close(scope, Exit.void);
			}
			return {
				...receiver,
				exportsCountWords: Effect.fn("AppStory.exportsCountWords")(function* () {
					tell("wait for the collector to receive the worker's CountWords span");
					yield* Effect.promise(() =>
						vi.waitFor(() => expect(receiver.spans.some((span) => span.name === "CountWords")).toBe(true), { timeout: 8000 }),
					);
					expect(receiver.requests).toContainEqual(
						expect.objectContaining({ headers: expect.objectContaining({ "x-collector-token": "worker collector secret" }), path: "/v1/traces" }),
					);
					expect(receiver.spans.find((span) => span.name === "CountWords")?.resourceAttributes).toEqual(
						expect.arrayContaining([
							{ key: "service.name", value: { stringValue: "worker-test" } },
							{ key: "deployment.environment", value: { stringValue: "worker-test" } },
						]),
					);
				}),
				omitsSecrets: Effect.fn("AppStory.omitsSecrets")(function* (secrets: readonly string[]) {
					tell("check that exported spans contain no application or collector secrets");
					yield* Effect.sync(() => {
						for (const secret of secrets) {
							expect(receiver.requests.every(({ body }) => !body.includes(Buffer.from(secret)))).toBe(true);
						}
					});
				}),
				receivesRequests: () => Effect.promise(() => vi.waitFor(() => expect(receiver.requests.length).toBeGreaterThan(0), { timeout: 8000 })),
				startWorker: (protocol?: string) => startWorker(tracingEnvironment(receiver.url, protocol)),
			};
		}),
	};
}

function tracingEnvironment(url: string, protocol?: string) {
	return protocol === undefined
		? { "OTEL_EXPORTER_OTLP_ENDPOINT": url }
		: {
				"OTEL_EXPORTER_OTLP_HEADERS": "x-collector-token=worker%20collector%20secret",
				"OTEL_EXPORTER_OTLP_PROTOCOL": protocol,
				"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": `${url}/v1/traces`,
				"OTEL_RESOURCE_ATTRIBUTES": "deployment.environment=worker-test",
				"OTEL_SERVICE_NAME": "worker-test",
			};
}
