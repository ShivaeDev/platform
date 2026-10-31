import { runtime } from "./kit.ts";

export const deferralWritesFail = runtime.trait("client", "the deferral store rejects every write", (engine) => {
	const db = engine.client.getDb();
	Object.assign(engine.client, {
		getDb: () => ({
			executeSql: (text: string) =>
				text.includes("WITH claimed AS MATERIALIZED") ? Promise.reject(new Error("deferral storage unavailable")) : db.executeSql(),
		}),
	});
});
