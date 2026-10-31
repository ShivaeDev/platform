import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { command } from "@shivaedev/contract/operation.ts";

export class EditExpired extends Schema.TaggedError<EditExpired>()("EditExpired", { message: Schema.String }) {}
const Save = command("save", { invalidates: () => [], rejections: { EditExpired }, success: Schema.String });
export const Notes = contract("socketClockNotes", { commands: [Save] });
