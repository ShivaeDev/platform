import net from "node:net";
import process from "node:process";
import { Config, Effect, Option, Predicate } from "effect";

function forbidden(): never {
	process.stderr.write("Fleet client attempted a direct PostgreSQL connection\n");
	process.exit(97);
}

const databaseUrl = Effect.runSync(Config.option(Config.String("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL")));
const databasePort = Option.map(databaseUrl, (url) => Number(new URL(url).port || "5432"));
const connect = net.Socket.prototype.connect;

// Every PostgreSQL client in the process, including the native Effect client, opens its connection through a net.Socket.
Reflect.set(net.Socket.prototype, "connect", function (this: net.Socket, ...args: unknown[]) {
	const [first] = args;
	// net.connect passes its normalized [options, callback] pair as one argument.
	const target: unknown = Array.isArray(first) ? first[0] : first;
	const port = Predicate.hasProperty(target, "port") ? Number(target.port) : Number(target);
	if (Option.isSome(databasePort) && port === databasePort.value) {
		forbidden();
	}
	return Reflect.apply(connect, this, args);
});
