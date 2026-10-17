### Changed

- The diagnostics contract declares a typed `ServiceUnavailable` rejection for `daemon.fleetItems`, so Board returns an unavailable Fleet items projection with a reason when the daemon rejects the read.
