import { Schema } from "effect";
import { contract } from "#contract.ts";
import { LiveHint } from "#live.ts";
import { query, stream } from "#operation.ts";
import { Create, Guard, Get as LocalGet, List as LocalList, notes, Rename } from "#test/notes.ts";
import { Unavailable } from "./contract.ts";

export const Get = query("get", {
	payload: LocalGet.payload,
	reads: ({ id }) => [notes.item(id)],
	rejections: { ...LocalGet.rejections, Unavailable },
	success: LocalGet.success,
});
export const List = query("list", { reads: () => [notes.list], success: LocalList.success });
export const Subscribe = stream("subscribe", { reads: () => [notes.list], rejections: { Unavailable }, success: LiveHint });
export const Watch = stream("watch", {
	payload: { helper: Schema.Literals(["first", "second"]), id: Schema.Number },
	reads: ({ id }) => [notes.item(id)],
	success: LiveHint,
});
export const LiveNotes = contract("notes", { commands: [Rename, Create], queries: [Get, List], streams: [Subscribe, Watch] }).middleware(Guard);
