import { Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { fieldRejection } from "#rejection.ts";

export const wireNotes = collection("wireNotes", Schema.Number);
export const NoteFields = Schema.Struct({ title: Schema.String });

export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields)) {}

export class WireCaller extends RpcMiddleware.Service<WireCaller>()("@shivaedev/contract/test/WireCaller") {}
