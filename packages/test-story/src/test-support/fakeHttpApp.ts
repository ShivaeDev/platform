import { Effect, Schema } from "effect";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";

const routes = {
	items: { pages: [["paper", "ink"], ["pens"], ["staples"]], path: "/items" },
	message: { method: "POST", path: "/messages", reply: () => ({ body: { saved: true }, status: 201 }) },
	user: { path: "/users/:id", reply: ({ params }: { readonly params: Readonly<Record<string, string>> }) => ({ body: { id: params.id } }) },
};

export const HttpPage = Schema.Struct({ items: Schema.Array(Schema.String), next: Schema.NullOr(Schema.Number) });
export type HttpPage = typeof HttpPage.Type;

function fakeHttpKit(guarded: boolean) {
	return storyKit({
		clock: "live",
		create: () => fakeHttpService({ ...(guarded ? { guard: ({ headers }) => headers.authorization === "Bearer story-key" } : {}), routes }),
		inspect: (service) => service.requests,
		name: guarded ? "fake HTTP service" : "public HTTP service",
		stages: ["ready"],
		verbs: (service, story) => {
			service.narrate(story.tell);
			function request(path: string, init: RequestInit = {}) {
				return Effect.tryPromise(async (signal) => {
					const response = await fetch(`${service.url}${path}`, { headers: { authorization: "Bearer story-key" }, ...init, signal });
					const text = await response.text();
					const body: unknown = text ? JSON.parse(text) : undefined;
					return { body, headers: Object.fromEntries(response.headers), status: response.status };
				});
			}
			return {
				closedUrl: () => Effect.scoped(Effect.map(fakeHttpService({ routes }), ({ url }) => url)),
				failOnce: service.failOnce,
				hold: service.hold,
				readPage: (page: number) =>
					request(page === 1 ? "/items" : `/items?page=${page}`).pipe(Effect.flatMap(({ body }) => Schema.decodeUnknownEffect(HttpPage)(body))),
				request,
				requests: () => service.requests.map(({ method, path, body }) => ({ body: body.toString(), method, path })),
			};
		},
	});
}

export const fakeHttpApp = fakeHttpKit(true);
export const publicHttpApp = fakeHttpKit(false);
