import process from "node:process";
import pg from "pg";

function forbidden(): never {
	process.stderr.write("Fleet client attempted a direct PostgreSQL connection\n");
	process.exit(97);
}

pg.Client.prototype.connect = forbidden;
pg.Pool.prototype.connect = forbidden;
