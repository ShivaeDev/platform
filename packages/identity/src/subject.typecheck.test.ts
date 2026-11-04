import { Effect, type Layer, Option, Schema } from "effect";
import { Rpc, type RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { permission } from "@shivaedev/access/permission.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";
import type { subjectLayers } from "@shivaedev/contract/subjectLayers.ts";
import { Identity, SessionUser } from "#identity.ts";
import type { IdentityFailures } from "#middleware.ts";
import { currentSessionContext } from "#server/currentSessionContext.ts";
import { revalidateStream } from "#server/revalidateStream.ts";
import type { SessionShape } from "#server/session.ts";
import { accountSubject, Subject, type SubjectId, type SubjectResolver, selfSubject } from "#subject.ts";

class CannotAct extends Schema.TaggedError<CannotAct>()("CannotAct", { account: Schema.String }) {}
const write = command("write", { invalidates: () => [] });
const Own = contract("own", { commands: [write], subject: selfSubject });
const Delegated = contract("delegated", {
	commands: [write],
	subject: accountSubject({ deny: (account) => new CannotAct({ account }), permission: permission("account.edit"), refusal: CannotAct }),
});
const service = Effect.gen(function* () {
	expectTypeOf((yield* Subject).id).toEqualTypeOf<SubjectId>();
	yield* Identity;
	yield* SessionUser;
});
const own: Layer.Layer<never> = Own.application.toLayer({ "own.write": () => service });
const delegated: Layer.Layer<never> = Delegated.application.toLayer({ "delegated.write": () => service });
const Plain = contract("plain", { commands: [write] });
// @ts-expect-error A contract without a subject cannot supply the service's request context.
const missing: Layer.Layer<never> = Plain.application.toLayer({ "plain.write": () => service });
// @ts-expect-error An unchecked client id is not an authorized subject id.
const unchecked: SubjectId = "alice";
// @ts-expect-error A refusal must match the declared error schema.
accountSubject({ deny: () => ({ _tag: "Other" }), permission: permission("account.edit"), refusal: CannotAct });
expectTypeOf<Rpc.ErrorExit<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Own>, "own.write">>>().toEqualTypeOf<IdentityFailures>();
expectTypeOf<Rpc.ErrorExit<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Delegated>, "delegated.write">>>().toEqualTypeOf<IdentityFailures | CannotAct>();
expectTypeOf<Rpc.Payload<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Own>, "own.write">>>().toEqualTypeOf<void>();
void [own, delegated, missing, unchecked];

expectTypeOf<Layer.Services<ReturnType<typeof subjectLayers<RpcGroup.Rpcs<typeof Own>>>>>().toEqualTypeOf<SubjectResolver>();

const Combined = Own.merge(Delegated);
expectTypeOf<Layer.Services<ReturnType<typeof subjectLayers<RpcGroup.Rpcs<typeof Combined>>>>>().toEqualTypeOf<SubjectResolver>();

expectTypeOf<Rpc.ServicesServer<RpcGroup.Rpcs<typeof Own>>>().toEqualTypeOf<never>();
expectTypeOf<Rpc.ServicesClient<RpcGroup.Rpcs<typeof Own>>>().toEqualTypeOf<never>();

const lookup = Effect.succeed(Option.none<SessionShape>());
currentSessionContext<SessionShape, never>("alice", lookup);
revalidateStream<SessionShape, never>(Rpc.make("read"), "alice", lookup);
