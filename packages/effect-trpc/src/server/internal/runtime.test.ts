import { TRPCError } from "@trpc/server";
import { Context } from "effect";
import { expect } from "vitest";
import { adapterServices, consumerInstrumentationThrows, consumerMapperThrows, runtimeAcquisitionFails } from "#test/adapterRouter.ts";
import { RuntimeValue } from "#test/adapterServices.ts";
import { trpc } from "#test/routerStory.ts";

trpc.it("maps pure interruption to CLIENT_CLOSED_REQUEST", [adapterServices()], function* ({ rejectCaller }) {
	const controller = new AbortController();
	controller.abort();
	const error = yield* rejectCaller("cancelled", undefined, controller.signal);
	expect(error).toBeInstanceOf(TRPCError);
	expect(error).toMatchObject({ code: "CLIENT_CLOSED_REQUEST", message: "Request cancelled" });
});
trpc.it("redacts defects thrown by consumer instrumentation", [adapterServices(), consumerInstrumentationThrows()], function* ({ rejectQuery }) {
	expect(yield* rejectQuery("services")).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" }, message: "Internal server error" });
});
trpc.it("redacts defects thrown by the consumer error mapper", [adapterServices(), consumerMapperThrows()], function* ({ rejectQuery }) {
	expect(yield* rejectQuery("domainFailure")).toMatchObject({ data: { code: "INTERNAL_SERVER_ERROR" }, message: "Internal server error" });
});
trpc.it("ends a subscription aborted before iteration", [adapterServices()], function* ({ subscribe, next }) {
	const controller = new AbortController();
	controller.abort();
	const iterator = yield* subscribe("neverStream", undefined, controller.signal);
	expect(yield* next(iterator)).toEqual({ done: true, value: undefined });
});
trpc.it("maps subscription failures to the consumer error", [adapterServices()], function* ({ subscribe, rejectNext, mapped }) {
	const iterator = yield* subscribe("failedStream");
	expect(yield* rejectNext(iterator)).toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "Updates temporarily unavailable" });
	expect(mapped).toEqual([{ error: "subscription unavailable", origin: "failure", path: "failedStream" }]);
});
trpc.it("keeps ambient subscription services after caller context returns", [adapterServices()], function* ({ subscribeWith, next }) {
	const iterator = yield* subscribeWith("ambientStream", Context.make(RuntimeValue, "test override"));
	expect(yield* next(iterator)).toEqual({ done: false, value: "test override" });
	expect(yield* next(iterator)).toEqual({ done: true, value: undefined });
});
trpc.it("maps subscription runtime acquisition failures", [adapterServices(), runtimeAcquisitionFails()], function* ({ rejectSubscription, mapped }) {
	expect(yield* rejectSubscription("stream")).toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
	expect(mapped).toEqual([{ error: expect.any(Error), origin: "failure", path: "stream" }]);
});
