import { Effect, Exit, Schema, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { httpProbe } from "#test/httpProbe.ts";

const routes = {
	contents: {
		path: "/repos/:owner/:repo/contents/:path*",
		reply: ({ params }: { readonly params: Readonly<Record<string, string>> }) => ({ body: params }),
	},
	invalidRest: { path: "/invalid/:path*/tail", reply: () => ({ status: HttpStatus.fromLiteral("OK") }) },
	items: { pages: [["paper", "ink"], ["pens"], ["staples"]], path: "/items" },
	message: { method: "POST", path: "/messages", reply: () => ({ body: { saved: true }, status: HttpStatus.fromLiteral("Created") }) },
	user: { path: "/users/:id", reply: ({ params }: { readonly params: Readonly<Record<string, string>> }) => ({ body: { id: params.id } }) },
};

export const HttpPage = Schema.Struct({ items: Schema.Array(Schema.String), next: Schema.NullOr(Schema.Number) });
export type HttpPage = typeof HttpPage.Type;

function fakeHttpKit(guarded: boolean, acquisitionTell = false) {
	const name = guarded ? "fake HTTP service" : "public HTTP service";
	return storyKit({
		clock: "live",
		*create() {
			const scope = yield* Scope.fork(yield* Scope.Scope);
			let tell: ((line: string) => void) | undefined;
			const service = yield* fakeHttpService({
				...(guarded ? { guard: ({ headers }) => headers.authorization === "Bearer story-key" } : {}),
				routes,
				tell: (line) => tell?.(line),
			}).pipe(Effect.provideService(Scope.Scope, scope));
			return {
				connectNarration: (sink: (line: string) => void) => {
					tell = sink;
				},
				headers: new Headers(),
				scope,
				service,
			};
		},
		inspect: ({ service }) => service.requests,
		name: acquisitionTell ? "HTTP acquisition narration" : name,
		stages: ["ready"],
		verbs: ({ connectNarration, headers, scope, service }, story) => {
			if (acquisitionTell) {
				connectNarration(story.tell);
			} else {
				service.narrate(story.tell);
			}
			function request(path: string, init: RequestInit = {}) {
				return Effect.tryPromise(async (signal) => {
					const response = await fetch(`${service.url}${path}`, { headers, ...init, signal });
					const text = await response.text();
					const body: unknown = text ? JSON.parse(text) : undefined;
					return { body, headers: Object.fromEntries(response.headers), status: response.status };
				});
			}
			return {
				close: () => Scope.close(scope, Exit.void),
				hold: service.hold,
				probe: (path: string) =>
					Effect.acquireRelease(
						Effect.sync(() => httpProbe(`${service.url}${path}`)),
						(client) => client.abort,
					),
				readPage: (page: number) =>
					request(page === 1 ? "/items" : `/items?page=${page}`).pipe(Effect.flatMap(({ body }) => Schema.decodeUnknownEffect(HttpPage)(body))),
				recordedRequests: () => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`),
				request,
				requests: () => service.requests.map(({ method, path, body }) => ({ body: body.toString(), method, path })),
				scriptFault: service.scriptFault,
				url: () => service.url,
			};
		},
	});
}

export const fakeHttpApp = fakeHttpKit(true);
export const publicHttpApp = fakeHttpKit(false);
export const acquisitionHttpApp = fakeHttpKit(false, true);

export function hasCredential(credential: string) {
	return fakeHttpApp.trait("ready", "the caller has an API credential", (engine) => {
		engine.headers.set("authorization", credential);
	});
}
