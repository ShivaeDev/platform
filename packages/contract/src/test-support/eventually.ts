import { Effect } from "effect";
import { eventually as retry } from "@shivaedev/test/eventually.ts";

export function eventually(check: () => void) {
	return retry(Effect.try({ catch: (error) => error, try: check }), { interval: "10 millis", times: 500 });
}
