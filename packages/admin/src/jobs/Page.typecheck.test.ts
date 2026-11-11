import { Context, Effect, type Layer, type Option, Schema, SchemaGetter } from "effect";
import type { RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import type { Bound } from "@shivaedev/contract/bind.ts";
import { moduleHandlers } from "@shivaedev/contract/moduleHandlers.ts";
import type { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import type { JobFailure } from "@shivaedev/jobs/JobFailure.ts";
import type { JobState } from "@shivaedev/jobs/server/job.ts";
import { makePgBoss } from "@shivaedev/jobs/server/service.ts";
import { Jobs } from "#Jobs.ts";
import { JobsWithRetry } from "#JobsWithRetry.ts";
import { JobsPage } from "#jobs/Page.ts";
import { JobsPageWithRetry } from "#jobs/PageWithRetry.ts";
import type { JobsRow } from "#jobs/Row.ts";
import { adminRegistry } from "#registry.ts";
import { pgBossQueues } from "#server/adapters/pgBossQueues.ts";
import type { RegisteredQueues } from "#server/RegisteredQueues.ts";
import { registerAdmin } from "#server/registerAdmin.ts";

class DecodePayload extends Context.Service<DecodePayload, string>()("@shivaedev/admin/test/DecodePayload") {}
class EncodePayload extends Context.Service<EncodePayload, string>()("@shivaedev/admin/test/EncodePayload") {}
const Payload = Schema.Struct({
	id: Schema.String.pipe(
		Schema.decodeTo(Schema.String, {
			decode: SchemaGetter.checkEffect(() => Effect.as(DecodePayload, true)),
			encode: SchemaGetter.checkEffect(() => Effect.as(EncodePayload, true)),
		}),
	),
});
const PgBossJobs = makePgBoss("test/AdminJobs");
const queues = pgBossQueues(
	PgBossJobs,
	{ name: "mail", schema: Payload },
	{ name: "sync", schema: Schema.Struct({ count: Schema.NumberFromString }) },
);
expectTypeOf<Layer.Services<typeof queues>>().toEqualTypeOf<"test/AdminJobs" | DecodePayload>();
expectTypeOf<Layer.Error<typeof queues>>().toEqualTypeOf<never>();
expectTypeOf<
	Layer.Services<ReturnType<typeof pgBossQueues<readonly [{ readonly name: "scheduled" }], "test/AdminJobs">>>
>().toEqualTypeOf<"test/AdminJobs">();

const registration = registerAdmin(adminRegistry(JobsPage), { jobs: moduleHandlers(Jobs) });
expectTypeOf<Layer.Services<typeof registration.handlers>>().toEqualTypeOf<RegisteredQueues | SessionPolicy>();
expectTypeOf<Layer.Error<typeof registration.handlers>>().toEqualTypeOf<never>();
type JobRpc = Extract<RpcGroup.Rpcs<typeof JobsPage.contract>, { readonly _tag: "admin.jobs.job" }>;
expectTypeOf<JobRpc["successSchema"]["EncodingServices"]>().toEqualTypeOf<never>();
expectTypeOf<JobRpc["successSchema"]["DecodingServices"]>().toEqualTypeOf<never>();
expectTypeOf<JobRpc["successSchema"]["Type"]>().toEqualTypeOf<Option.Option<JobsRow>>();
expectTypeOf<JobsRow["data"]>().toEqualTypeOf<unknown>();
expectTypeOf<JobsRow["state"]>().toEqualTypeOf<JobState>();
expectTypeOf<JobsRow["output"]>().toEqualTypeOf<JobFailure | null>();
type ReadOnly = typeof JobsPage.contract.declaration;
type ReadOnlyClient = Bound<ReadOnly["name"], ReadOnly["queries"], ReadOnly["commands"], RpcGroup.Rpcs<typeof JobsPage.contract>, never>;
expectTypeOf<Extract<keyof ReadOnlyClient, "retry" | "runScheduleNow">>().toEqualTypeOf<never>();
type CountsQuery = Extract<ReadOnly["queries"][number], { readonly name: "counts" }>;
expectTypeOf<CountsQuery["success"]["Type"]>().toEqualTypeOf<{
	readonly activeCount: number;
	readonly failedCount: number;
	readonly queuedCount: number;
	readonly totalCount: number;
}>();

const retryRegistration = registerAdmin(adminRegistry(JobsPageWithRetry), { jobs: moduleHandlers(JobsWithRetry) });
expectTypeOf<Layer.Services<typeof retryRegistration.handlers>>().toEqualTypeOf<RegisteredQueues | SessionPolicy>();
type RetryRpc = Extract<RpcGroup.Rpcs<typeof JobsPageWithRetry.contract>, { readonly _tag: "admin.jobs.retry" }>;
expectTypeOf<RetryRpc["payloadSchema"]["Type"]>().toEqualTypeOf<{ readonly id: string; readonly queue: string }>();
// @ts-expect-error The read-only module cannot serve the retry page, whose commands it lacks.
registerAdmin(adminRegistry(JobsPageWithRetry), { jobs: moduleHandlers(Jobs) });
