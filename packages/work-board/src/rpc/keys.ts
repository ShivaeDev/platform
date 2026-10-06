import { Schema } from "effect";
import { collection } from "@shivaedev/effect-contract/keys.ts";

export const workspace = collection("work-board/workspace", Schema.String);
export const documents = collection("work-board/documents", Schema.String);
export const identities = collection("work-board/identities", Schema.String);
export const navigation = collection("work-board/navigation", Schema.String);
export const index = collection("work-board/index", Schema.String);
export const watcher = collection("work-board/watcher", Schema.String);
