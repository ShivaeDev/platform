import { Context, Effect, Schema } from "effect";
import { expectTypeOf } from "vitest";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { permissionReadPolicy } from "#permissionReadPolicy.ts";
import { signedIn } from "#readPolicy.ts";

const workspaces = collection("workspaces", Schema.Int);
class Permissions extends Context.Service<Permissions, boolean>()("test/CollectionPolicyTypes") {}
class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
const policy = permissionReadPolicy({ name: "workspaces.manage" }, () =>
	Effect.flatMap(Permissions, (allowed) => (allowed ? Effect.succeed(true) : Effect.fail(new Unavailable()))),
);
const All = query("all", { readPolicy: policy, reads: () => [], readsCollections: [workspaces], rejections: { Unavailable } });
const Workspaces = contract("workspaces", { queries: [All] });
const handlers = Workspaces.application.toLayer({ "workspaces.all": () => Effect.void });
expectTypeOf<Effect.Services<ReturnType<typeof All.readPolicy>>>().toEqualTypeOf<Permissions>();
expectTypeOf<Effect.Error<ReturnType<typeof All.readPolicy>>>().toEqualTypeOf<Unavailable>();
void handlers;

// @ts-expect-error A signed-in member policy cannot declare collection-wide reads.
query("member", { readPolicy: signedIn, reads: () => [], readsCollections: [workspaces] });
// @ts-expect-error An arbitrary policy cannot declare collection-wide reads.
query("unguarded", { readPolicy: () => Effect.succeed(true), reads: () => [], readsCollections: [workspaces] });
// @ts-expect-error Permission check failures must be declared rejections.
query("missingRejection", { readPolicy: policy, reads: () => [], readsCollections: [workspaces] });
