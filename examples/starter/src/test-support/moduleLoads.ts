import { registerHooks } from "node:module";
import process from "node:process";

registerHooks({
	load(url, context, nextLoad) {
		const loaded = nextLoad(url, context);
		if (/\/NodeHttpServer\.[jt]s$|\/(?:redis|@redis)[\/@]/v.test(url)) {
			process.stdout.write(`Loaded module: ${url}\n`);
		}
		return loaded;
	},
});
