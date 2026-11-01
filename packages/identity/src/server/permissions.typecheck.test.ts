import { Context, Data, Effect } from "effect";
import { HttpServerResponse } from "effect/http";
import { expectTypeOf } from "vitest";
import { Identity, SessionUser } from "#identity.ts";
import type { HostRouteGuard } from "#test/auth/HostRouteGuard.ts";
import { UseTools } from "#test/auth/permissions.ts";
import { permissionRoute } from "./permissions.ts";
import type { SessionPolicy } from "./SessionPolicy.ts";

class Required extends Context.Service<Required, string>()("admin-route/Required") {}
class HandlerFailure extends Data.TaggedError("HandlerFailure") {}

const guard = permissionRoute(UseTools);
function mount(routeGuard: HostRouteGuard) {
	return routeGuard(() => Effect.map(Required, HttpServerResponse.text));
}
const mounted = mount(guard);
const guarded = guard(() =>
	Effect.gen(function* () {
		yield* Identity;
		yield* SessionUser;
		yield* Required;
		return yield* new HandlerFailure();
	}),
);

expectTypeOf<Effect.Services<ReturnType<typeof mounted>>>().toEqualTypeOf<Required | SessionPolicy>();
expectTypeOf<Effect.Services<ReturnType<typeof guarded>>>().toEqualTypeOf<Required | SessionPolicy>();
expectTypeOf<Effect.Error<ReturnType<typeof guarded>>>().toEqualTypeOf<HandlerFailure>();
