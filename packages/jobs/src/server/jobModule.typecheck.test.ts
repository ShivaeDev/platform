import { Context, Effect, type Layer, Schema } from "effect";
import { expectTypeOf, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { jobModule } from "#jobModule.ts";
import type { PgBoss } from "#PgBoss.ts";
import { makePgBoss } from "#service.ts";

class Port extends Context.Service<Port, string>()("test/module/Port") {}
const Queue = defineQueue({ name: "module", schema: Schema.Struct({ value: Schema.NumberFromString }) });
const Jobs = makePgBoss("test/ModuleJobs");
const module = jobModule(Jobs.layer, { jobs: [Queue.handle(() => Port.pipe(Effect.asVoid))] });

it("module fields preserve the worker's services and the jobs service identifier", () => {
	expectTypeOf<Layer.Services<typeof module.workers>>().toEqualTypeOf<PgBoss | Port>();
	expectTypeOf<Layer.Success<typeof module.workers>>().toEqualTypeOf<"test/ModuleJobs">();
});

it("module queues preserve the payload schema of worker registrations", () => {
	expectTypeOf<(typeof module.queues)[number]["schema"]>().toEqualTypeOf<typeof Queue.schema>();
});

const producer = jobModule(Jobs.layer, { jobs: [Queue] });
it("module queues preserve bare queue definitions", () => {
	expectTypeOf<(typeof producer.queues)[number]>().toEqualTypeOf<typeof Queue>();
});
