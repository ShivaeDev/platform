import { Context, Data, Effect } from "effect";
import { type HttpServerRequest, HttpServerResponse } from "effect/http";
import { expectTypeOf } from "vitest";
import { Identity, SessionUser } from "#identity.ts";
import { permissionRoute } from "#server/adapters/permissionRoute.ts";
import type { SessionPolicy } from "#server/SessionPolicy.ts";
import type { HostRouteGuard } from "#test/auth/HostRouteGuard.ts";
import { UseTools } from "#test/auth/permissions.ts";

class Required extends Context.Service<Required, string>()("@shivaedev/identity/admin-route/Required") {}
class HandlerFailure extends Data.TaggedError("HandlerFailure") {}

const guard = permissionRoute(UseTools);
function mount(routeGuard: HostRouteGuard) {
	return routeGuard(Effect.map(Required, HttpServerResponse.text));
}
const mounted = mount(guard);
const guarded = guard(
	Effect.gen(function* () {
		yield* Identity;
		yield* SessionUser;
		yield* Required;
		return yield* new HandlerFailure();
	}),
);

expectTypeOf<Effect.Services<typeof mounted>>().toEqualTypeOf<Required | SessionPolicy | HttpServerRequest.HttpServerRequest>();
expectTypeOf<Effect.Services<typeof guarded>>().toEqualTypeOf<Required | SessionPolicy | HttpServerRequest.HttpServerRequest>();
expectTypeOf<Effect.Error<typeof guarded>>().toEqualTypeOf<HandlerFailure>();
