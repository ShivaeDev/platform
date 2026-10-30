import { Data, Effect, type Layer, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { expectTypeOf } from "vitest";
import { appDatabase, appHost } from "#appHost.ts";

class ComponentUnavailable extends Data.TaggedError("ComponentUnavailable")<{ readonly message: string }> {}

const unavailable = Effect.fail(new ComponentUnavailable({ message: "unavailable" }));
const migrations = {
	components: [{ apply: unavailable, name: "storage", pending: unavailable }],
	loader: Migrator.fromRecord({}),
};
const group = RpcGroup.make(Rpc.make("read", { success: Schema.String }));
const handlers = group.toLayer({ read: () => Effect.succeed("ready") });
const database = appDatabase({ migrations });
const host = appHost({ group, handlers, migrations, policy: "loopback" });
const deferred = appHost({ application: Effect.succeed({ group, handlers, policy: "loopback" as const }), migrations });

expectTypeOf<Extract<Layer.Error<typeof database>, ComponentUnavailable>>().toEqualTypeOf<ComponentUnavailable>();
expectTypeOf<Extract<Layer.Error<typeof host>, ComponentUnavailable>>().toEqualTypeOf<ComponentUnavailable>();
expectTypeOf<Extract<Layer.Error<typeof deferred>, ComponentUnavailable>>().toEqualTypeOf<ComponentUnavailable>();
