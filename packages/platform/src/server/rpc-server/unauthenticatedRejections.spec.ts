import { Cause, Effect, Exit, Layer, Schema } from "effect";
import { HttpRouter } from "effect/http";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { expect, it } from "vitest";
import { Conflict, InternalServerError, ServiceUnavailable } from "#errors/taxonomy.ts";
import { RequestTracing } from "#rpc/middleware.ts";
import { rpcBoundary } from "#rpc-server/boundary.ts";
import { requestTracingLayer } from "#rpc-server/tracing.ts";
import { httpClient, recorder, rpcHttp } from "#test/rpc/harness.ts";

const Rejection = Schema.Union([Conflict, InternalServerError, ServiceUnavailable]);
const Api = RpcGroup.make(Rpc.make("Save", { error: Rejection, payload: { mode: Schema.String }, success: Schema.String })).middleware(
	RequestTracing,
);
const original = new Error("Storage failed with password=private-value");
const Handlers = Api.toLayer({
	Save: ({ mode }) =>
		Effect.suspend(() => {
			if (mode === "conflict") {
				return Effect.fail(new Conflict({ field: "name", message: "Name is taken" }));
			}
			if (mode === "unavailable") {
				return Effect.fail(new ServiceUnavailable({ message: "Storage is unavailable" }));
			}
			return mode === "defect" ? Effect.die(original) : Effect.fail(original);
		}).pipe(rpcBoundary(Rejection, { unexpected: (message) => new InternalServerError({ message }) })),
});
it("unauthenticated native HTTP RPC keeps declared types, redacts unexpected failures and retains causes in server traces", async () => {
	const recorded = recorder();
	const app = HttpRouter.toWebHandler(
		rpcHttp(Api).pipe(
			Layer.provide(Layer.merge(Handlers, requestTracingLayer())),
			Layer.provideMerge(recorded.layer),
			Layer.provide(RpcSerialization.layerJson),
		),
		{ disableLogger: true },
	);
	try {
		function call(mode: string) {
			return Effect.runPromise(
				Effect.gen(function* () {
					const client = yield* RpcClient.make(Api);
					return yield* Effect.flip(client.Save({ mode }));
				}).pipe(Effect.provide(httpClient(app, {})), Effect.scoped),
			);
		}
		const conflict = await call("conflict");
		expect(conflict).toBeInstanceOf(Conflict);
		expect(conflict).toMatchObject({ field: "name", message: "Name is taken" });
		expect(await call("unavailable")).toBeInstanceOf(ServiceUnavailable);
		for (const mode of ["failure", "defect"]) {
			const rejection = await call(mode);
			expect(rejection).toBeInstanceOf(InternalServerError);
			expect(rejection).toMatchObject({ message: "Internal server error" });
			expect(rejection.cause).toBeUndefined();
			expect(JSON.stringify(rejection)).not.toContain("private-value");
		}
		const traced = recorded.spans
			.filter((span) => span.name === "RpcServer.Save")
			.flatMap((span) => {
				if (span.status._tag !== "Ended" || !Exit.isFailure(span.status.exit)) {
					return [];
				}
				return span.status.exit.cause.reasons.filter(Cause.isFailReason).map((reason) => reason.error);
			});
		const unexpected = traced.filter((error) => error instanceof InternalServerError);
		expect(unexpected).toHaveLength(2);
		for (const rejection of unexpected) {
			expect(Cause.isCause(rejection.cause) && Cause.squash(rejection.cause)).toBe(original);
		}
	} finally {
		await app.dispose();
	}
});
