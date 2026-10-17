### Fixed

- Generated apps can select the auth client IP header with `AUTH_CLIENT_IP_HEADER`, still gated by `TRUSTED_PROXY`. Railway uses `x-real-ip` so different visitor IPs have separate auth rate-limit buckets and the same visitor IP shares a bucket across changing `X-Forwarded-For` values. Other deployments keep the `x-forwarded-for` default.
