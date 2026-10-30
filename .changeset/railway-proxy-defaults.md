---
"@shivaedev/server": minor
"@shivaedev/create-app": minor
---

### Breaking

- `@shivaedev/server` refuses to start a session host bound to a non-loopback address without proxy trust, with a typed `TrustedProxyRequired` error naming the missing setting. Set `TRUSTED_PROXY` to your proxy's peer IP addresses or CIDR ranges, set `config.trustedProxy`, or deploy with the starter's Railway configuration. Local loopback hosts keep working without it.

### Changed

- The starter's Railway deployment supplies `TRUSTED_PROXY=100.64.0.0/10` and `AUTH_CLIENT_IP_HEADER=x-real-ip` through its shared proxy configuration. Generated deployment docs explain the automatic Railway settings and when a host refuses to boot.
