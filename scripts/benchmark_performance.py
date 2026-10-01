r"""Measure API performance for the solar forecasting prototype.

Run the API first, for example:
    .\venv\Scripts\python.exe -m uvicorn api.main:app --port 8000

Then run:
    .\venv\Scripts\python.exe scripts\benchmark_performance.py

This is a lightweight load test. It reports latency percentiles, error rate,
and throughput. It does not change forecasts or database records.
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_ENDPOINTS = {
    "forecast": "/api/forecast?scale_level=national&horizon=d_to_d3&capacity_kwp=1&unit=MW&confidence_level=0.9",
    "spatial_summary": "/api/spatial/summary?horizon=d_to_d3&capacity_kwp=1&unit=MW",
    "dispatch_preview": "/api/dispatch/preview?scale_level=national&horizon=d_to_d3&capacity_kwp=1&unit=MW",
    "telemetry": "/api/telemetry",
}


@dataclass
class Result:
    endpoint: str
    requests: int
    successful: int
    failed: int
    total_seconds: float
    requests_per_second: float
    min_ms: Optional[float]
    average_ms: Optional[float]
    p50_ms: Optional[float]
    p95_ms: Optional[float]
    p99_ms: Optional[float]
    max_ms: Optional[float]
    errors: list[str]


def percentile(values: list[float], percent: float) -> Optional[float]:
    if not values:
        return None
    values = sorted(values)
    index = (len(values) - 1) * percent / 100
    lower = int(index)
    upper = min(lower + 1, len(values) - 1)
    fraction = index - lower
    return values[lower] + (values[upper] - values[lower]) * fraction


def request_once(url: str, timeout: float) -> tuple[float, Optional[str]]:
    started = time.perf_counter()
    try:
        request = Request(url, headers={"Accept": "application/json", "User-Agent": "performance-benchmark/1.0"})
        with urlopen(request, timeout=timeout) as response:
            response.read()
            if response.status < 200 or response.status >= 300:
                return (time.perf_counter() - started) * 1000, f"HTTP {response.status}"
        return (time.perf_counter() - started) * 1000, None
    except HTTPError as error:
        return (time.perf_counter() - started) * 1000, f"HTTP {error.code}"
    except (URLError, TimeoutError, OSError) as error:
        return (time.perf_counter() - started) * 1000, f"{type(error).__name__}: {error}"


def benchmark(name: str, url: str, count: int, concurrency: int, timeout: float, warmup: int) -> Result:
    for _ in range(warmup):
        request_once(url, timeout)

    started = time.perf_counter()
    timings: list[float] = []
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(request_once, url, timeout) for _ in range(count)]
        for future in as_completed(futures):
            elapsed_ms, error = future.result()
            timings.append(elapsed_ms)
            if error:
                errors.append(error)

    total_seconds = time.perf_counter() - started
    successful = len(timings) - len(errors)
    return Result(
        endpoint=name,
        requests=count,
        successful=successful,
        failed=len(errors),
        total_seconds=round(total_seconds, 3),
        requests_per_second=round(successful / total_seconds, 2) if total_seconds else 0.0,
        min_ms=round(min(timings), 2) if timings else None,
        average_ms=round(statistics.mean(timings), 2) if timings else None,
        p50_ms=round(percentile(timings, 50) or 0, 2) if timings else None,
        p95_ms=round(percentile(timings, 95) or 0, 2) if timings else None,
        p99_ms=round(percentile(timings, 99) or 0, 2) if timings else None,
        max_ms=round(max(timings), 2) if timings else None,
        errors=sorted(set(errors))[:5],
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark the running forecasting API")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="API origin")
    parser.add_argument("--requests", type=int, default=50, help="Requests per endpoint")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent requests")
    parser.add_argument("--warmup", type=int, default=2, help="Warmup requests per endpoint")
    parser.add_argument("--timeout", type=float, default=15, help="Request timeout in seconds")
    parser.add_argument("--json", dest="json_path", help="Also save results to a JSON file")
    args = parser.parse_args()

    if args.requests < 1 or args.concurrency < 1:
        parser.error("--requests and --concurrency must be positive")

    base_url = args.base_url.rstrip("/")
    print(f"Benchmark target: {base_url}")
    print(f"Requests per endpoint: {args.requests}; concurrency: {args.concurrency}; warmup: {args.warmup}\n")

    results = []
    for name, path in DEFAULT_ENDPOINTS.items():
        result = benchmark(name, base_url + path, args.requests, args.concurrency, args.timeout, args.warmup)
        results.append(asdict(result))
        print(
            f"{name:18} success={result.successful:3}/{result.requests:<3} "
            f"avg={result.average_ms or 0:7.2f} ms "
            f"p95={result.p95_ms or 0:7.2f} ms "
            f"throughput={result.requests_per_second:7.2f} req/s"
        )
        if result.errors:
            print(f"  errors: {', '.join(result.errors)}")

    payload = {
        "target": base_url,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "configuration": {
            "requests_per_endpoint": args.requests,
            "concurrency": args.concurrency,
            "warmup": args.warmup,
            "timeout_seconds": args.timeout,
        },
        "results": results,
    }
    if args.json_path:
        with open(args.json_path, "w", encoding="utf-8") as output:
            json.dump(payload, output, indent=2)
        print(f"\nSaved report to {args.json_path}")

    return 0 if all(row["failed"] == 0 for row in results) else 1


if __name__ == "__main__":
    sys.exit(main())
