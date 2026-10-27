import { DateTime, Option } from "effect";

const httpDate = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/u;

export function parseRetryAfter(header: string | undefined, now: DateTime.Utc): DateTime.Utc | undefined {
	if (header === undefined) {
		return undefined;
	}
	const value = header.trim();
	let millis = Number.NaN;
	if (/^\d+$/u.test(value)) {
		millis = DateTime.toEpochMillis(now) + Number(value) * 1000;
	} else if (httpDate.test(value)) {
		millis = Date.parse(value);
	}
	return Option.getOrUndefined(DateTime.make(millis));
}
