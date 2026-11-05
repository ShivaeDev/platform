import { Effect } from "effect";
import { writeItem } from "#test/writeItem.ts";

export const rename = Effect.fn("Items.rename")((value: string) => Effect.asVoid(writeItem(value)));
