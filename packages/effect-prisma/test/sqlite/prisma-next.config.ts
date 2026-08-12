import { defineConfig } from "@prisma-next/sqlite/config";

export default defineConfig({
	contract: "generated/contract.prisma",
	db: {
		connection:
			process.env.PLATFORM_EFFECT_PRISMA_TEST_SQLITE_PATH ?? "generated/dev.db",
	},
});
