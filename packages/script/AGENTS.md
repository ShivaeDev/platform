# @shivaedev/script

This package lets a development script stay a short Effect program. It owns the Node entry point, argument parsing and the scope around the work; serving applications belongs to server.

Keep native Effect arguments, Config, logging and services visible. Prefer correct scope closure and interruption, then native composition, then a small public surface. The script supplies its application Layers inside its run effect; do not grow a second service or configuration model here.

See [README.md](./README.md) for the entry point and its consumer contract, and the repository [AGENTS.md](../../AGENTS.md) for shared engineering rules.
