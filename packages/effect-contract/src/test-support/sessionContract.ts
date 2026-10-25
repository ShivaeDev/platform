import { Context, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { contract } from "#contract.ts";
import { collection } from "#keys.ts";
import { command, query } from "#operation.ts";

export class Session extends Context.Service<Session, string>()("test/PrivateSession") {}
export class Guard extends RpcMiddleware.Service<Guard, { provides: Session }>()("test/PrivateGuard") {}
export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", {}) {}
export const preferences = collection("preferences", Schema.Number);
export const Self = query("self", { reads: () => [preferences.item(0)], success: Schema.String });
export const List = query("list", { reads: () => [preferences.list], success: Schema.Array(Schema.String) });
export const Get = query("get", { payload: { id: Schema.Number }, reads: ({ id }) => [preferences.item(id)], success: Schema.String });
export const Save = command("save", {
	invalidates: () => [preferences.item(0)],
	payload: { title: Schema.String },
	rejections: { Rejected },
	success: Schema.Void,
});
export const Preferences = contract("preferences", { commands: [Save], keyScope: "session", queries: [Self, List, Get] }).middleware(Guard);
