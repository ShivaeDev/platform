import { Context, Effect, Ref, Schema } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { adminJobsWire } from "#generated/test-support/FakeJobs.ts";
import { JobsPermission } from "#permissions.ts";
import { jobs } from "#test/jobs.ts";

export class FailedJobs extends Context.Service<FailedJobs, Ref.Ref<readonly string[]>>()("@shivaedev/admin/test/FailedJobs") {}

const Failed = query("failed", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [jobs.list],
	*run() {
		return yield* Ref.get(yield* FailedJobs);
	},
});

const Retry = command("retry", {
	invalidates: () => [jobs.list],
	payload: { id: Schema.String },
	*run({ id }) {
		yield* Ref.update(yield* FailedJobs, (ids) => ids.filter((value) => value !== id));
	},
});

// Written as an application writes an admin page's operations, over an in-memory list of failed job ids.
export const FakeJobs = defineModule({
	middleware: JobsPermission,
	name: "admin.jobs",
	operations: [Failed, Retry],
	wire: adminJobsWire,
});
