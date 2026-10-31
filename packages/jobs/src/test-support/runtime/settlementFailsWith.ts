import { runtime } from "./kit.ts";

export function settlementFailsWith(error: Error) {
	return runtime.trait("client", "the database rejects job completion", (engine) => {
		Object.assign(engine.client, { complete: () => Promise.reject(error) });
	});
}
