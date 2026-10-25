import { Effect, Schema } from "effect";
import { Rpc } from "effect/rpc";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { LiveHint } from "@shivaedev/effect-contract/live.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { fieldRejection } from "@shivaedev/effect-contract/rejection.ts";
import { Authenticated } from "@shivaedev/platform/rpc/middleware.ts";

export const Settings = Schema.Struct({
	pageSize: Schema.Number.pipe(Schema.withDecodingDefaultKey(Effect.succeed(25))),
	title: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("Workspace"))),
});
export const EntitySettings = Schema.Struct({
	entityId: Schema.Number,
	...Settings.fields,
});
export class Missing extends Schema.TaggedError<Missing>()("Missing", {}) {}
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export const settings = collection("entity-settings", Schema.Number);
export const GetSettings = query("get", {
	payload: { entityId: Schema.Number },
	reads: ({ entityId }) => [settings.item(entityId)],
	rejections: { Missing, Unavailable },
	success: EntitySettings,
});
export const SaveSettings = command("save", {
	invalidates: ({ entityId }) => [settings.item(entityId)],
	payload: EntitySettings.fields,
	rejections: {
		InvalidSettings: fieldRejection(Settings),
		Missing,
		Unavailable,
	},
	success: EntitySettings,
});
export const SettingsContract = contract("settings", {
	commands: [SaveSettings],
	queries: [GetSettings],
}).middleware(Authenticated);
const Subscribe = Rpc.make("subscribe", {
	error: Schema.Union([Missing, Unavailable]),
	payload: { entityId: Schema.Number },
	stream: true,
	success: LiveHint,
}).middleware(Authenticated);
export const SettingsRpc = SettingsContract.add(Subscribe);
export const SettingsApplication = SettingsContract.application.add(Subscribe);
