### Added

- `AppHostOptions.config.trustedProxy` / `TRUSTED_PROXY` and `localRpcGuard(effect, trustedProxy?)` accept comma-separated IPv4 and IPv6 addresses and CIDR ranges, including IPv4-mapped IPv6 peers. Invalid proxy addresses or ranges fail `appHost` startup with a typed `ConfigError` before migrations, services or HTTP start.
