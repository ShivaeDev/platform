import { POSTGRES_IMAGE } from "./localContainer.ts";

export class PostgresSettingError extends Error {
	readonly _tag = "PostgresSettingError";
	readonly container = "development-postgres";
	readonly setting = "max_connections";

	constructor(message: string, options: ErrorOptions) {
		super(message, options);
		this.name = "PostgresSettingError";
	}
}

export function ensureConnections(docker: (args: readonly string[]) => string, sql: (query: string) => string, ready: () => void) {
	try {
		const current = Number(sql("SHOW max_connections"));
		if (!Number.isInteger(current) || current <= 0) {
			throw new Error("PostgreSQL returned an invalid max_connections value.");
		}
		if (current >= 500) {
			return;
		}
		if (docker(["inspect", "--format", "{{.Config.Image}}", "development-postgres"]).trim() !== POSTGRES_IMAGE) {
			throw new Error("The shared PostgreSQL container uses a different image. Preserve its data and upgrade it explicitly.");
		}
		sql("ALTER SYSTEM SET max_connections = 500");
		docker(["restart", "development-postgres"]);
		ready();
		if (!(Number(sql("SHOW max_connections")) >= 500)) {
			throw new Error("PostgreSQL did not apply max_connections after restarting.");
		}
	} catch (cause) {
		throw new PostgresSettingError("Could not set max_connections to at least 500 in container development-postgres.", { cause });
	}
}
