import { Context, Effect, type Layer, type Option, Schema, SchemaGetter } from "effect";
import type { RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { makePgBoss } from "@shivaedev/effect-pg-boss/server/service.ts";
import { adminRegistry } from "#registry.ts";
import { jobsHandlers } from "#server/jobsHandlers.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { jobsPage } from "./page.ts";

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
