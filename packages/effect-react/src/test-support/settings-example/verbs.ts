import { Deferred, Effect } from "effect";
import type { Settings } from "./contract.ts";
import { type Engine, screen } from "./engine.ts";
import { request } from "./request.ts";

export function verbs(engine: Engine, tell: (line: string) => void) {
	engine.screen.tell = tell;
	return {
		commitHasEntered: () => {
			tell("the transaction waits before committing the settings and their invalidation key");
			return Deferred.await(engine.gate.entered).pipe(Effect.timeout("3 seconds"));
		},
		edit: (name: string, field: "title" | "pageSize", value: string) => screen(engine, name).driver.enter(`input[name="${field}"]`, value),
		observe: (line: string, check: () => void) => engine.screen.observe(line, check),
		queryAs: (token: string, entityId: number) => {
			tell(`${token} queries entity ${entityId} settings over HTTP`);
			return request(engine.url, token, entityId);
		},
		releaseCommit: () => {
			tell("the settings transaction may commit");
			return Deferred.succeed(engine.gate.released, undefined);
		},
		save: (name: string) => screen(engine, name).driver.submit(),
		saveAs: (token: string, entityId: number, input: typeof Settings.Type) => {
			tell(`${token} saves entity ${entityId} settings over HTTP`);
			return request(engine.url, token, entityId, input);
		},
		settle: (name: string) => screen(engine, name).driver.settle(),
		storedSettings: engine.stored,
		view: (name: string) => {
			const { container, registry, client } = screen(engine, name);
			return {
				connection: registry.get(client.status).connection,
				error: container.querySelector('[role="alert"]')?.textContent,
				pageSize: container.querySelector<HTMLInputElement>('input[name="pageSize"]')?.value,
				status: container.querySelector('[role="status"]')?.textContent,
				title: container.querySelector<HTMLInputElement>('input[name="title"]')?.value,
				value: container.querySelector("output")?.textContent,
			};
		},
	};
}
