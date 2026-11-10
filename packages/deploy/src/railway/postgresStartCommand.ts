export interface PageCacheTrim {
	checkIntervalSeconds?: number;
	fallbackIntervalSeconds?: number;
	thresholdBytes?: number;
}

export const postgresEntrypoint = ["/usr/bin/tini", "-g", "--", "/usr/local/bin/wrapper.sh"];
export const postgresCmd = ["postgres", "-p", "5432", "-c", "listen_addresses=*"];

export function postgresStartCommand({ thresholdBytes = 262_144_000, checkIntervalSeconds = 30, fallbackIntervalSeconds = 900 }: PageCacheTrim = {}) {
	const chain = [...postgresEntrypoint, ...postgresCmd].map((part) => JSON.stringify(part)).join(" ");
	return `/bin/sh -c 'last=0; while sleep ${checkIntervalSeconds}; do now=$(date +%s); if [ "$(cat /sys/fs/cgroup/memory.current)" -gt ${thresholdBytes} ] || [ $((now - last)) -ge ${fallbackIntervalSeconds} ]; then find "$PGDATA" -type f -exec dd iflag=nocache count=0 status=none if={} \\; 2>/dev/null; last=$now; fi; done & exec ${chain}'`;
}
