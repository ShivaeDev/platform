import { database } from "#test/database.ts";

database.it("application Layers built inside isolation acquire the clone's client", [], function* ({ applicationLayersUseTheirOwnClient }) {
	yield* applicationLayersUseTheirOwnClient();
});
