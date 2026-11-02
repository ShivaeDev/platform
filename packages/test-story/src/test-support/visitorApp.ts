import { Effect, Schema } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { type HttpVisitorOptions, httpVisitor, type VisitorRequest } from "#httpVisitor.ts";
import { storyKit } from "#storyKit.ts";
import { visitorHost } from "./visitorHost.ts";

const HostReadout = Schema.Struct({
	body: Schema.String,
	cookies: Schema.String,
	forwardedFor: Schema.String,
	forwardedHost: Schema.String,
	method: Schema.String,
	origin: Schema.String,
	path: Schema.String,
	realIp: Schema.String,
	scheme: Schema.String,
});

export const visitorApp = storyKit({
	*create() {
		const upstream = yield* visitorHost();
		return { upstream, visitors: new Map<string, Effect.Success<ReturnType<typeof httpVisitor>>>() };
	},
	name: "HTTP visitor",
	stages: ["visitors"],
	verbs: ({ visitors }, story) => ({
		as: (name: string) => {
			const client = visitors.get(name);
			if (client === undefined) {
				throw new Error(`No HTTP visitor named ${name}.\nhelp: Open the visitor in a story trait before using as(name).`);
			}
			return {
				asks: (path = "/echo", init: VisitorRequest = {}) => {
					story.tell(`${name} sends ${init.method ?? "GET"} ${path}`);
					return client.request(path, init).pipe(
						Effect.flatMap((response) => Effect.promise(() => response.json())),
						Effect.flatMap(Schema.decodeUnknownEffect(HostReadout)),
					);
				},
				receivesCookies: (cookies: readonly string[], path = "/cookies") => {
					story.tell(`${name} receives cookies from ${path}`);
					return client.request(path, { body: JSON.stringify(cookies), method: "POST" }).pipe(
						Effect.flatMap((response) => Effect.promise(() => response.text())),
						Effect.asVoid,
					);
				},
				visitsRedirect: () => {
					story.tell(`${name} visits a redirect`);
					return client.request("/redirect").pipe(Effect.map((response) => `HTTP ${response.status} to ${response.headers.get("location")}`));
				},
			};
		},
		timePasses: (seconds: number) => {
			story.tell(`${seconds} seconds pass`);
			return TestClock.adjust(seconds * 1000);
		},
	}),
});

export function visitor(name: string, options: HttpVisitorOptions = { baseUrl: "https://app.example" }) {
	return visitorApp.trait("visitors", `${name} visits the app`, function* ({ upstream, visitors }) {
		visitors.set(name, yield* httpVisitor(upstream, options));
	});
}
