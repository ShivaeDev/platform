import { Context } from "effect";

export interface PostgresExecutables {
	readonly initdb: string;
	readonly pgDump: string;
	readonly postgres: string;
}

export class PostgresBinaries extends Context.Service<PostgresBinaries, PostgresExecutables>()("@shivaedev/local-postgres/PostgresBinaries") {}
