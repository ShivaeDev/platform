import { Context, Effect, Layer, Schema, Stream } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import type { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import type { AuthUnavailable, Forbidden, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { adminRegistry, mergeAdminRegistries } from "#registry.ts";
import { mergeAdminRegistrations } from "#server/mergeAdminRegistrations.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Failed, Jobs, JobsContract, Registry, Users } from "#test/pages.ts";

class JobStore extends Context.Service<JobStore, { readonly failed: readonly string[] }>()("test/JobStore") {}
class Configuration extends Context.Service<Configuration, string>()("test/Configuration") {}
class SetupFailed extends Schema.TaggedError<SetupFailed>()("SetupFailed", {}) {}

const jobs = Jobs.contract.application.toLayer(
	Effect.gen(function* () {
		const configuration = yield* Configuration;
		if (configuration === "") {
			return yield* new SetupFailed();
		}
		return Jobs.contract.application.of({
			"admin.jobs.failed": () => Effect.map(JobStore, (store) => store.failed),
			"admin.jobs.retry": ({ id }) => Effect.asVoid(Effect.succeed(id)),
			"admin.jobs.watch": () => Stream.fromEffect(Effect.map(JobStore, (store) => store.failed)),
		});
	}),
);
const users = Users.contract.application.toLayer({ "admin.users.profile": () => Effect.map(SessionUser, (user) => user.email) });
const registration = registerAdmin(Registry, { jobs, users });
expectTypeOf<Layer.Services<typeof registration.handlers>>().toEqualTypeOf<JobStore | Configuration>();
expectTypeOf<Layer.Error<typeof registration.handlers>>().toEqualTypeOf<SetupFailed>();
expectTypeOf(Jobs.contract.declaration).toEqualTypeOf(JobsContract.declaration);
expectTypeOf(Jobs.contract.declaration.queries[0]).toEqualTypeOf(Failed);
expectTypeOf(Users.contract.declaration.commands).toEqualTypeOf<readonly []>();
expectTypeOf<RpcGroup.Rpcs<typeof Users.contract>["_tag"]>().toEqualTypeOf<"admin.users.profile" | "admin.users.$changes">();

// @ts-expect-error Every registered page must have a handler Layer.
registerAdmin(Registry, { jobs });
// @ts-expect-error A Layer with no handlers cannot implement the registered page.
registerAdmin(Registry, { jobs: Layer.empty, users });
// @ts-expect-error Handlers for a different page cannot implement jobs.
registerAdmin(Registry, { jobs: users, users });
const extra = { jobs, other: users, users };
// @ts-expect-error Handler keys must match exactly, including previously assigned objects.
registerAdmin(Registry, extra);
// @ts-expect-error A registered Layer still requires the handler's application services.
const missingServices: Layer.Layer<Layer.Success<typeof registration.handlers>, SetupFailed> = registration.handlers;
void missingServices;
// @ts-expect-error Pages must pass through adminPage before entering the registry.
adminRegistry({ contract: JobsContract, id: "unprotected", route: Jobs.route });

Jobs.contract.application.toLayer({
	// @ts-expect-error Query success types remain those of the native contract.
	"admin.jobs.failed": () => Effect.succeed(42),
	"admin.jobs.retry": () => Effect.void,
	"admin.jobs.watch": () => Stream.empty,
});

type ProfileRpc = Extract<RpcGroup.Rpcs<typeof Users.contract>, { readonly _tag: "admin.users.profile" }>;
expectTypeOf<Rpc.Error<ProfileRpc>>().toEqualTypeOf<AuthUnavailable | Forbidden | Unauthorized | MissingReadPolicy | QueryReadDenied>();

const jobsModule = registerAdmin(adminRegistry(Jobs), { jobs });
const usersModule = registerAdmin(adminRegistry(Users), { users });
const combined = mergeAdminRegistrations(jobsModule, usersModule);
expectTypeOf(combined.handlers).toEqualTypeOf(registration.handlers);
expectTypeOf(combined.pages).toEqualTypeOf<readonly [typeof Jobs, typeof Users]>();
expectTypeOf(combined.group).toEqualTypeOf(Registry.group);
// @ts-expect-error Modules cannot contribute the same page id.
mergeAdminRegistrations(jobsModule, jobsModule);
// @ts-expect-error Browser registries reject page ids shared by modules.
mergeAdminRegistries(jobsModule, jobsModule);
// @ts-expect-error A registry cannot contain duplicate page ids.
adminRegistry(Jobs, Jobs);
// @ts-expect-error A module must register its page handlers before composition.
mergeAdminRegistrations(adminRegistry(Jobs), usersModule);

// @ts-expect-error A module cannot bypass handler registration with an empty Layer.
mergeAdminRegistrations({ ...adminRegistry(Jobs), handlers: Layer.empty });
