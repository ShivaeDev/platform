import { DateTime } from "effect";

export function enGbTime(instant: string | undefined, timeZone: string) {
	return DateTime.format(DateTime.makeUnsafe(instant ?? ""), { dateStyle: "medium", locale: "en-GB", timeStyle: "long", timeZone });
}
