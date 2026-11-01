import { Effect, Queue, Redacted, Schema } from "effect";
import { fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { Email } from "#Email.ts";
import { resendMailerLayer } from "#server/adapters/resendMailerLayer.ts";

export interface ReceivedEmail extends Email {
	readonly idempotencyKey: string | undefined;
}

export const inbox = Effect.fnUntraced(function* () {
	const arrivals = yield* Queue.unbounded<ReceivedEmail>();
	const emails: ReceivedEmail[] = [];
	const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Email));
	const endpoint = yield* fakeHttpService({
		routes: {
			send: {
				method: "POST",
				path: "/emails",
				reply: (request) => {
					const email = { ...decode(request.body.toString()), idempotencyKey: request.headers["idempotency-key"]?.toString() };
					emails.push(email);
					Queue.offerUnsafe(arrivals, email);
					return { body: { id: `email-${emails.length}` } };
				},
			},
		},
	});
	yield* routeOutbound({ "api.resend.com": endpoint.url });
	return {
		emails: () => Effect.sync(() => [...emails]),
		endpoint,
		mailerLayer: resendMailerLayer({ apiKey: Redacted.make("re_story") }),
		nextEmail: Queue.take(arrivals).pipe(Effect.timeout("10 seconds")),
	};
});

export function emailLink(email: Email): string {
	const link = email.text.match(/https?:\/\/[^\s<>]+/u)?.[0];
	if (link === undefined) {
		throw new Error("The delivered email has no link in its text");
	}
	return link;
}
