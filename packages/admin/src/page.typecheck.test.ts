import type { Effect } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type { RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { bind } from "@shivaedev/contract/bind.ts";
import type { SessionUser } from "@shivaedev/identity/identity.ts";
import { JobsPermission } from "#permissions.ts";
import { collectionPage } from "#test/collectionPage.ts";
import { Jobs } from "#test/pages.ts";

const page = collectionPage();
expectTypeOf(page.contract.declaration.keyScope).toEqualTypeOf<"session">();
expectTypeOf(page.contract.middleware(JobsPermission).declaration.keyScope).toEqualTypeOf<"session">();
expectTypeOf(Jobs.contract.declaration.keyScope).toEqualTypeOf<undefined>();
type ReadPolicy = (typeof page.contract.declaration.queries)[0]["readPolicy"];
expectTypeOf<Effect.Services<ReturnType<ReadPolicy>>>().toEqualTypeOf<SessionUser>();

declare const client: AtomRpc.AtomRpcClient<"test/Client", "test/Client", RpcGroup.Rpcs<typeof page.contract>>;
declare const registry: AtomRegistry.AtomRegistry;
bind(page.contract, client, { registry });
// @ts-expect-error Admin pages retain the session contract's owning-registry requirement.
bind(page.contract, client);
// @ts-expect-error Other binding options do not replace the owning registry.
bind(page.contract, client, { live: false });
