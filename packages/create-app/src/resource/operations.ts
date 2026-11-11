import type { ResourceNames } from "#resource/names.ts";

export function resourceCreate({ name, pascal }: ResourceNames) {
	return `import { Effect } from "effect";
import { command } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { Fields, toItem } from "#modules/${name}/model.ts";
import { ${pascal}Repository } from "#modules/${name}/server/Repository.ts";

export const Create = command("create", {
	payload: Fields,
	*run({ title }) {
		const repository = yield* ${pascal}Repository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.insert({ title, userId }).pipe(Effect.map(toItem));
	},
});
`;
}

export function resourceList({ name, pascal }: ResourceNames) {
	return `import { query } from "@shivaedev/contract/operation.ts";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { ${pascal}Repository } from "#modules/${name}/server/Repository.ts";

export const List = query("list", {
	*run() {
		const repository = yield* ${pascal}Repository;
		const { id: userId } = yield* SessionUser;
		return yield* repository.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id", "title"], where: { userId } });
	},
});
`;
}
