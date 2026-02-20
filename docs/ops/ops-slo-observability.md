# /_ops SLO + Alerting + Dashboard Pack

Last updated: 2026-02-20

## Scope

This pack covers the Worker control-plane endpoints:

- `/_ops/health`
- `/_ops/version`
- `/_ops/metrics`
- `/_ops/log-ping`

`/_ops/logs` and `/_ops/logging` are telemetry ingest endpoints and are monitored separately.

## SLOs and alert thresholds

| SLO | SLI | Target | Primary alert |
|---|---|---:|---|
| Availability | `2xx/3xx requests ÷ all requests` | `>= 99.9%` (30d) | P1 when 5m availability `< 99.9%` for 10m |
| Latency | `p95 request duration` | `<= 300ms` (30d) | P1 when p95 `> 300ms` for 10m |
| Error rate | `(5xx requests) ÷ all requests` | `< 1%` (30d) | P1 when 5m error rate `> 1%` for 10m |
| Rate limit impact | `(429 requests) ÷ all requests` | `< 2%` (30d) | P2 when 5m ratio `> 2%` for 15m |

## `/_ops/metrics` endpoint contract

- Default output: Prometheus exposition text.
- Optional JSON output: `/_ops/metrics?format=json`.
- Auth header: `x-ops-token: <token>`.
- Token source in Worker env:
  - preferred: `OPS_METRICS_TOKEN`
  - fallback: `OPS_LOG_TOKEN`
- If no token is configured, endpoint returns `503 metrics_token_missing`.

## Metrics emitted

- `converttoit_ops_requests_total{endpoint,method,status_code,status_class}`
- `converttoit_ops_request_duration_seconds_bucket{endpoint,le}`
- `converttoit_ops_request_duration_seconds_sum{endpoint}`
- `converttoit_ops_request_duration_seconds_count{endpoint}`
- `converttoit_ops_rejections_total{endpoint,reason}`
- `converttoit_ops_shadow_rate_limited_total{endpoint,scope}`
- `converttoit_ops_slo_target_ratio{objective}`
- `converttoit_ops_rate_limit_limit{scope}`
- `converttoit_ops_rate_limit_window_seconds{scope}`
- `converttoit_ops_rate_limiter_active_clients{scope}`
- `converttoit_ops_process_start_time_seconds`
- `converttoit_ops_uptime_seconds`
- `converttoit_ops_build_info{service,environment,app_version,build_sha}`

## Data model note

- Counters/histograms are isolate-local in-memory metrics.
- They reset on cold starts and new deploys.
- Keep SLO windows in Prometheus (or remote write storage), not in Worker memory.

## Quick verification

```bash
# 1) record one control-plane request
curl -fsS https://converttoit.com/_ops/health > /dev/null

# 2) scrape Prometheus text
curl -fsS \
  -H "x-ops-token: $CF_OPS_METRICS_TOKEN" \
  "https://converttoit.com/_ops/metrics" | head -40

# 3) inspect JSON schema
curl -fsS \
  -H "x-ops-token: $CF_OPS_METRICS_TOKEN" \
  "https://converttoit.com/_ops/metrics?format=json" | jq .
```

## Prometheus scrape example

```yaml
scrape_configs:
  - job_name: converttoit_ops
    metrics_path: /_ops/metrics
    scheme: https
    static_configs:
      - targets: ["converttoit.com"]
    http_config:
      headers:
        x-ops-token: "${CF_OPS_METRICS_TOKEN}"
```

## Import templates

- Grafana dashboard JSON: `grafana-ops-slo-dashboard.json` (under `docs/ops/observability/`)
- Prometheus alerts: `prometheus-ops-alert-rules.yml` (under `docs/ops/observability/`)

Import the dashboard in Grafana (`Dashboards -> New -> Import`) and paste/upload the JSON file.
