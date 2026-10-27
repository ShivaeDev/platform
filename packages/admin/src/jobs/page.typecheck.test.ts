import { Context, Effect, type Layer, type Option, Schema, SchemaGetter } from "effect";
import type { RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import type { Bound } from "@shivaedev/contract/bind.ts";
import { defineSchedule } from "@shivaedev/jobs/server/definition.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { adminRegistry } from "#registry.ts";
import { jobsHandlers } from "#server/jobsHandlers.ts";
import { jobsHandlersWithRetry } from "#server/jobsHandlersWithRetry.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { jobsPage } from "./page.ts";
import { jobsPageWithRetry } from "./retryPage.ts";

class DecodePayload extends Context.Service<DecodePayload, string>()("test/DecodePayload") {}
class EncodePayload extends Context.Service<EncodePayload, string>()("test/EncodePayload") {}
const Payload = Schema.Struct({
	id: Schema.String.pipe(
		Schema.decodeTo(Schema.String, {
			decode: SchemaGetter.checkEffect(() => Effect.as(DecodePayload, true)),
			encode: SchemaGetter.checkEffect(() => Effect.as(EncodePayload, true)),
		}),
	),
});
const Jobs = makePgBoss("test/AdminJobs");
const page = jobsPage({ name: "mail", schema: Payload }, { name: "sync", schema: Schema.Struct({ count: Schema.NumberFromString }) });
const registration = registerAdmin(adminRegistry(page), { jobs: jobsHandlers(page, Jobs) });
expectTypeOf<Layer.Services<typeof registration.handlers>>().toEqualTypeOf<"test/AdminJobs" | DecodePayload>();
expectTypeOf<Layer.Error<typeof registration.handlers>>().toEqualTypeOf<never>();
expectTypeOf(page.contract.declaration.commands).toEqualTypeOf<readonly []>();
type JobRpc = Extract<RpcGroup.Rpcs<typeof page.contract>, { readonly _tag: "admin.jobs.job" }>;
expectTypeOf<JobRpc["successSchema"]["EncodingServices"]>().toEqualTypeOf<EncodePayload>();
expectTypeOf<JobRpc["successSchema"]["DecodingServices"]>().toEqualTypeOf<DecodePayload>();
type Job = JobRpc["successSchema"]["Type"] extends Option.Option<infer A> ? A : never;
expectTypeOf<Job["data"]>().toEqualTypeOf<{ readonly id: string } | { readonly count: number }>();

const retryPage = jobsPageWithRetry(...page.queues);
const retryRegistration = registerAdmin(adminRegistry(retryPage), { jobs: jobsHandlersWithRetry(retryPage, Jobs) });
expectTypeOf<Layer.Services<typeof retryRegistration.handlers>>().toEqualTypeOf<"test/AdminJobs" | DecodePayload>();
expectTypeOf(retryPage.contract.declaration.commands[0].name).toEqualTypeOf<"retry">();
type ReadOnly = typeof page.contract.declaration;
type ReadOnlyClient = Bound<ReadOnly["name"], ReadOnly["queries"], ReadOnly["commands"], RpcGroup.Rpcs<typeof page.contract>, never>;
expectTypeOf<Extract<keyof ReadOnlyClient, "retry">>().toEqualTypeOf<never>();
type RetryRpc = Extract<RpcGroup.Rpcs<typeof retryPage.contract>, { readonly _tag: "admin.jobs.retry" }>;
expectTypeOf<RetryRpc["payloadSchema"]["Type"]>().toEqualTypeOf<{ readonly id: string; readonly queue: string }>();

const emptyPage = jobsPage();
const emptyRegistration = registerAdmin(adminRegistry(emptyPage), { jobs: jobsHandlers(emptyPage, Jobs) });
expectTypeOf<Layer.Services<typeof emptyRegistration.handlers>>().toEqualTypeOf<"test/AdminJobs">();
expectTypeOf(emptyPage.queues).toEqualTypeOf<readonly []>();
const scheduledPage = jobsPage(...page.queues, defineSchedule({ cron: "0 * * * *", name: "scheduled" }));
const scheduledRegistration = registerAdmin(adminRegistry(scheduledPage), { jobs: jobsHandlers(scheduledPage, Jobs) });
expectTypeOf<Layer.Services<typeof scheduledRegistration.handlers>>().toEqualTypeOf<"test/AdminJobs" | DecodePayload>();
type ScheduledJobRpc = Extract<RpcGroup.Rpcs<typeof scheduledPage.contract>, { readonly _tag: "admin.jobs.job" }>;
type ScheduledJob = ScheduledJobRpc["successSchema"]["Type"] extends Option.Option<infer A> ? A : never;
expectTypeOf<ScheduledJob["data"]>().toEqualTypeOf<{ readonly id: string } | { readonly count: number } | null>();
expectTypeOf<ScheduledJobRpc["successSchema"]["EncodingServices"]>().toEqualTypeOf<EncodePayload>();
