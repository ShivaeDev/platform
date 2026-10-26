import { Context, Effect, Layer, Schema } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { expectTypeOf } from "vitest";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { appHost } from "#server/appHost.ts";

class Required extends Context.Service<Required, string>()("changes-test/Required") {}
const Api = contract("changes", { queries: [query("read", { reads: () => [], success: Schema.String })] });
const options = {
	group: Api,
	handlers: Api.application.toLayer({ "changes.read": () => Required }),
	migrations: { loader: Migrator.fromRecord({}) },
	policy: "loopback" as const,
};
const incomplete = appHost(options);
const complete = appHost({ ...options, services: Layer.effect(Required, Effect.succeed("ready")) });

expectTypeOf<Layer.Services<typeof incomplete>>().toEqualTypeOf<Required>();
expectTypeOf<Layer.Services<typeof complete>>().toEqualTypeOf<never>();

expectTypeOf<Layer.Success<typeof options.handlers>>().toEqualTypeOf<Rpc.Handler<"changes.read">>();
expectTypeOf<RpcGroup.Rpcs<typeof Api>["_tag"]>().toEqualTypeOf<"changes.read" | "changes.$changes">();
