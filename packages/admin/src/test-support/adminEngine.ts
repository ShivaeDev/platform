import { Effect, Layer, Option, Ref, Stream } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { permissionLayer } from "@shivaedev/identity/server/permissions.ts";
import type { UserSessionShape } from "@shivaedev/identity/server/session.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { JobsPermission, UsersPermission } from "#permissions.ts";
import { adminRegistry } from "#registry.ts";
import { mergeAdminRegistrations } from "#server/mergeAdminRegistrations.ts";
import { registerAdmin } from "#server/registerAdmin.ts";
import { Access } from "./Access.ts";
import { Jobs, Users } from "./pages.ts";

export const adminEngine = Effect.gen(function* () {
	const session = yield* Ref.make<Option.Option<UserSessionShape>>(Option.none());
	const failed = yield* Ref.make<readonly string[]>(["mail-42"]);
	const live = yield* makeLiveServer.pipe(Effect.provide(Reactivity.layer));
	const jobsModule = registerAdmin(adminRegistry(Jobs), {
		jobs: Jobs.contract.application.toLayer({
			"admin.jobs.failed": () => Ref.get(failed),
			"admin.jobs.retry": ({ id }) => Ref.update(failed, (ids) => ids.filter((value) => value !== id)),
			"admin.jobs.watch": () => Stream.fromEffect(Ref.get(failed)),
		}),
	});
	const usersModule = registerAdmin(adminRegistry(Users), {
		users: Users.contract.application.toLayer({
			"admin.users.profile": () => Effect.map(SessionUser, (user) => user.email),
		}),
	});
	const registration = mergeAdminRegistrations(jobsModule, usersModule);
	const changes = hostChanges(registration.group, AppChanges).pipe(Layer.provide(Layer.succeed(AppChanges, live)));
	const policy = {
		origin: () => true,
		provider: { get: () => Ref.get(session) },
		roles: Access,
	};
	const auth = Layer.merge(permissionLayer(JobsPermission, policy), permissionLayer(UsersPermission, policy));
	const client = yield* RpcTest.makeClient(registration.group).pipe(Effect.provide(Layer.mergeAll(registration.handlers, changes, auth)));
	return { client, session };
});
