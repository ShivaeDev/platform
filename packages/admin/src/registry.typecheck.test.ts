import { Layer } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import type { MissingReadPolicy, QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import type { WebSocketRequired } from "@shivaedev/contract/WebSocketRequired.ts";
import type { AuthUnavailable, Forbidden, InternalServerError, ServiceUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { adminRegistry, mergeAdminRegistries } from "#registry.ts";
import { mergeAdminRegistrations } from "#server/mergeAdminRegistrations.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { type FailedJobs, FakeJobs } from "#test/FakeJobs.ts";
import { FakeUsers } from "#test/FakeUsers.ts";
import { Jobs, Registry, Users } from "#test/pages.ts";

const registration = registerAdmin(Registry, { jobs: FakeJobs, users: FakeUsers });
expectTypeOf<Layer.Services<typeof registration.handlers>>().toEqualTypeOf<FailedJobs | SessionPolicy>();
expectTypeOf<Layer.Error<typeof registration.handlers>>().toEqualTypeOf<never>();
expectTypeOf<RpcGroup.Rpcs<typeof registration.group>["_tag"]>().toEqualTypeOf<
	"admin.jobs.failed" | "admin.jobs.retry" | "admin.jobs.$changes" | "admin.users.profile" | "admin.users.$changes"
>();

// @ts-expect-error Every registered page must have a module.
registerAdmin(Registry, { jobs: FakeJobs });
// @ts-expect-error A module that serves other operations cannot serve the page.
registerAdmin(Registry, { jobs: FakeUsers, users: FakeUsers });
// @ts-expect-error A handler Layer is not a module.
registerAdmin(Registry, { jobs: Layer.empty, users: FakeUsers });
const extra = { jobs: FakeJobs, other: FakeUsers, users: FakeUsers };
// @ts-expect-error Module keys must match the page ids exactly, including previously assigned objects.
registerAdmin(Registry, extra);
// @ts-expect-error A registration still requires the module's application services.
const missingServices: Layer.Layer<Layer.Success<typeof registration.handlers>, never, SessionPolicy> = registration.handlers;
void missingServices;
// @ts-expect-error Pages must pass through adminPage before entering the registry.
adminRegistry({ contract: FakeJobs, id: "unprotected", route: Jobs.route });

type ProfileRpc = Extract<RpcGroup.Rpcs<typeof Users.contract>, { readonly _tag: "admin.users.profile" }>;
expectTypeOf<Rpc.Error<ProfileRpc>>().toEqualTypeOf<
	AuthUnavailable | Forbidden | InternalServerError | MissingReadPolicy | QueryReadDenied | ServiceUnavailable | Unauthorized | WebSocketRequired
>();

const jobsModule = registerAdmin(adminRegistry(Jobs), { jobs: FakeJobs });
const usersModule = registerAdmin(adminRegistry(Users), { users: FakeUsers });
const combined = mergeAdminRegistrations(jobsModule, usersModule);
expectTypeOf(combined.handlers).toEqualTypeOf(registration.handlers);
expectTypeOf(combined.pages).toEqualTypeOf<readonly [typeof Jobs, typeof Users]>();
expectTypeOf(combined.group).toEqualTypeOf(registration.group);
// @ts-expect-error Modules cannot contribute the same page id.
mergeAdminRegistrations(jobsModule, jobsModule);
// @ts-expect-error Browser registries reject page ids shared by modules.
mergeAdminRegistries(jobsModule, jobsModule);
// @ts-expect-error A registry cannot contain duplicate page ids.
adminRegistry(Jobs, Jobs);
// @ts-expect-error A module must register its page before composition.
mergeAdminRegistrations(adminRegistry(Jobs), usersModule);
