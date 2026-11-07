import type { ResourceNames } from "#resource/names.ts";

export function resourceCreate({ name, pascal }: ResourceNames) {
	return `import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import type { Create } from "#modules/${name}/${name}.ts";
import { ${pascal}Repository } from "./Repository.ts";
import { unavailable } from "./unavailable.ts";

export const create = Effect.fn("${pascal}Service.create")(function* (input: typeof Create.payload.Type) {
	const repository = yield* ${pascal}Repository;
	const { id: userId } = yield* SessionUser;
	return yield* repository.insert({ ...input, userId }).pipe(Effect.catchTag("SqlError", (cause) => Effect.fail(unavailable(cause))));
});
`;
}

export function resourceList({ pascal }: ResourceNames) {
	return `import { Effect } from "effect";
import { SessionUser } from "@shivaedev/identity/identity.ts";
import { ${pascal}Repository } from "./Repository.ts";
import { unavailable } from "./unavailable.ts";

export const list = Effect.fn("${pascal}Service.list")(function* () {
	const repository = yield* ${pascal}Repository;
	const { id: userId } = yield* SessionUser;
	return yield* repository
		.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id", "title"], where: { userId } })
		.pipe(Effect.catchTag("SqlError", (cause) => Effect.fail(unavailable(cause))));
});
`;
}

export function resourceUnavailable({ name }: ResourceNames) {
	return `import type { SqlError } from "effect/sql/SqlError";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";

export const unavailable = (cause: SqlError) => Object.assign(new ServiceUnavailable({ message: "Could not reach the ${name} database" }), { cause });
`;
}
