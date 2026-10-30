import { Context, Effect, Option, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {}) {}
export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", {}) {}
export class Access extends Context.Service<
	Access,
	{
		allowed: boolean;
		checks: number;
		rejection: "denied" | "NotFound" | "Rejected";
	}
>()("test/DeniedAccess") {}
export class Guard extends RpcMiddleware.Service<Guard>()("test/DeniedGuard", { error: Schema.Union([MissingReadPolicy, QueryReadDenied]) }) {}
export const records = collection("denied-records", Schema.Number);
const policy = Effect.fnUntraced(function* (_payload: unknown, viewer: Option.Option<{ readonly id: string }>) {
	const access = yield* Access;
	access.checks += 1;
	if (access.rejection === "NotFound") {
		return yield* new NotFound();
	}
	if (access.rejection === "Rejected") {
		return yield* new Rejected();
	}
	return access.allowed || Option.isSome(viewer);
});
const declaration = { readPolicy: policy, reads: () => [records.item(1)], rejections: { NotFound, Rejected }, success: Schema.String };
export const Records = contract("denied-records", {
	queries: [query("hints", declaration), query("pushed", { ...declaration, live: "rerun-and-compare" })],
}).middleware(Guard);
