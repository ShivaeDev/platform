import process from "node:process";
import { DateTime, Schema } from "effect";
import { timestampText } from "#client/timestampText.ts";

const Dates = Schema.fromJsonString(Schema.Struct({ locale: Schema.optional(Schema.String), timeZone: Schema.optional(Schema.String) }));

const [instant = "", dates = "{}"] = process.argv.slice(2);
process.stdout.write(timestampText(DateTime.makeUnsafe(instant), Schema.decodeUnknownSync(Dates)(dates)));
