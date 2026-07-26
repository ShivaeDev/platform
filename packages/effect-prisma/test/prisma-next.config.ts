import { defineConfig } from "@prisma-next/postgres/config";

export default defineConfig({
	contract: "generated/contract.prisma",
	db: {
		connection:
			process.env.PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL ??
			"postgresql://integration-tests-disabled",
	},
});
