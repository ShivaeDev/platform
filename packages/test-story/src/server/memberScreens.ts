import { Effect, Option, type Scope } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { GlobalWindow } from "happy-dom";
import { domFetch } from "#domFetch.ts";
import { memberFetch } from "#internal/adapters/memberFetch.ts";
import { documentTransport } from "#internal/documentTransport.ts";
import { type DomCookie, seedCookies } from "#seedCookies.ts";

export interface MemberScreen {
	readonly fetch: typeof globalThis.fetch;
	readonly name: string;
	readonly registry: AtomRegistry.AtomRegistry;
	readonly root: HTMLDivElement;
}

export function memberScreens<E, R, TVerbs>(options: {
	readonly baseUrl: string;
	readonly mount: (member: MemberScreen) => Effect.Effect<void, E, R | Scope.Scope>;
	readonly verbs: (member: MemberScreen, tell: (line: string) => void) => TVerbs;
}) {
	const members = new Map<string, MemberScreen>();
	return {
		open: Effect.fnUntraced(function* (name: string, cookies: readonly DomCookie[]) {
			const browser = yield* Effect.acquireRelease(
				Effect.sync(() => new GlobalWindow({ url: options.baseUrl })),
				(target) => Effect.promise(() => target.happyDOM.abort()).pipe(Effect.andThen(Effect.sync(() => target.close()))),
			);
			browser.happyDOM.settings.fetch.interceptor = documentTransport(globalThis.fetch);
			yield* seedCookies(cookies, browser);
			const member = yield* Effect.acquireRelease(
				Effect.sync(() => {
					const root = document.createElement("div");
					document.body.append(root);
					return {
						fetch: domFetch(options.baseUrl, { fetch: memberFetch(browser), location: browser.location }),
						name,
						registry: AtomRegistry.make(),
						root,
					};
				}),
				({ registry, root }) =>
					Effect.sync(() => {
						members.delete(name);
						registry.dispose();
						root.remove();
					}),
			);
			yield* options.mount(member);
			members.set(name, member);
		}),
		verbs: (tell: (line: string) => void) => ({
			as: (name: string) => {
				const member = Option.getOrThrowWith(
					Option.fromUndefinedOr(members.get(name)),
					() => new Error(`No screen is open for ${JSON.stringify(name)}.\nhelp: Open this member in a story trait before using as(name).`),
				);
				return options.verbs(member, (line) => tell(`${name}: ${line}`));
			},
		}),
	};
}
