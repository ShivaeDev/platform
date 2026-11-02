import { Cache, Effect, Exit, Schema, Stream } from "effect";
import { decodedPages } from "#pagedLists.ts";
import type { Representations } from "#representations.ts";

export const InstalledRepository = Schema.Struct({
	htmlUrl: Schema.String,
	id: Schema.Number,
	name: Schema.String,
	owner: Schema.Struct({ login: Schema.String }),
	private: Schema.Boolean,
}).pipe(Schema.encodeKeys({ htmlUrl: "html_url" }));

export interface ViewerRepositoryAccess {
	readonly administrable: readonly (typeof InstalledRepository.Type & { readonly installationId: number })[];
	readonly readable: readonly (typeof InstalledRepository.Type & { readonly installationId: number })[];
}

const Account = Schema.Struct({ login: Schema.String });
const Installation = Schema.Struct({ id: Schema.Number });
const Permission = Schema.Struct({ permission: Schema.String });

const installationAccess = Effect.fnUntraced(function* (client: Representations, installationId: number, login: string) {
	const pages = yield* decodedPages(client, "/installation/repositories?per_page=100", InstalledRepository, {
		arrayKey: "repositories",
	}).pipe(Stream.runCollect);
	const readable: ViewerRepositoryAccess["readable"][number][] = [];
	const administrable: ViewerRepositoryAccess["administrable"][number][] = [];
	for (const repository of pages.flatMap((page) => page.items)) {
		const permissionPath = `/repos/${encodeURIComponent(repository.owner.login)}/${encodeURIComponent(repository.name)}/collaborators/${encodeURIComponent(login)}/permission`;
		const permission = yield* Effect.flatMap(client.read(permissionPath), (response) => response.decode(Permission)).pipe(
			Effect.map((grant) => grant.permission),
			Effect.catchTag("RemoteNotFound", () => Effect.succeed("none")),
		);
		const installed = { ...repository, installationId };
		if (!repository.private || ["read", "triage", "write", "maintain", "admin"].includes(permission)) {
			readable.push(installed);
		}
		if (permission === "admin") {
			administrable.push(installed);
		}
	}
	return { administrable, readable } satisfies ViewerRepositoryAccess;
});

export function viewerRepositoryAccess(app: Representations, installation: (id: number) => Effect.Effect<Representations>) {
	const lookup = Effect.fnUntraced(function* (account: string) {
		const path = account.startsWith("id:") ? `/user/${account.slice(3)}` : `/users/${encodeURIComponent(account.slice(6))}`;
		const installations = yield* decodedPages(app, "/app/installations?per_page=100", Installation).pipe(Stream.runCollect);
		const first = installations.flatMap((page) => page.items)[0];
		if (first === undefined) {
			return { administrable: [], readable: [] } satisfies ViewerRepositoryAccess;
		}
		const resolver = yield* installation(first.id);
		const { login } = yield* Effect.flatMap(resolver.read(path), (response) => response.decode(Account));
		const readable: ViewerRepositoryAccess["readable"][number][] = [];
		const administrable: ViewerRepositoryAccess["administrable"][number][] = [];
		for (const { id } of installations.flatMap((page) => page.items)) {
			const client = yield* installation(id);
			const access = yield* installationAccess(client, id, login);
			readable.push(...access.readable);
			administrable.push(...access.administrable);
		}
		return { administrable, readable } satisfies ViewerRepositoryAccess;
	});
	return Cache.makeWith(lookup, { capacity: 100, timeToLive: (exit) => (Exit.isSuccess(exit) ? "60 seconds" : 0) });
}
