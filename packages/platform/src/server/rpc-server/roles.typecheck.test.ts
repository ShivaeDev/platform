import { Context, Data, Effect, Option } from "effect";
import { HttpServerResponse } from "effect/http";
import { expectTypeOf } from "vitest";
import { Identity, SessionUser } from "#rpc/identity.ts";
import type { HostRouteGuard } from "#test/auth/HostRouteGuard.ts";
import { adminRoute } from "./roles.ts";

class Required extends Context.Service<Required, string>()("admin-route/Required") {}
class HandlerFailure extends Data.TaggedError("HandlerFailure") {}

const guard = adminRoute({ origin: () => true, provider: { get: () => Effect.succeed(Option.none()) } });
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

expectTypeOf<Effect.Services<ReturnType<typeof mounted>>>().toEqualTypeOf<Required>();
expectTypeOf<Effect.Services<ReturnType<typeof guarded>>>().toEqualTypeOf<Required>();
expectTypeOf<Effect.Error<ReturnType<typeof guarded>>>().toEqualTypeOf<HandlerFailure>();
