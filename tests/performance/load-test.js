import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 50 }, // Stay at 50 users for 3 minutes
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'], // Error rate should be less than 10%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test health endpoint
  let healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  sleep(1);

  // Test products listing
  let productsRes = http.get(`${BASE_URL}/api/products`);
  check(productsRes, {
    'products list status is 200': (r) => r.status === 200,
    'products list has data': (r) => r.json('data') !== undefined,
    'products list response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(2);

  // Test single product
  if (productsRes.status === 200 && productsRes.json('data.products.length') > 0) {
    const products = productsRes.json('data.products');
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    
    let productRes = http.get(`${BASE_URL}/api/products/${randomProduct._id}`);
    check(productRes, {
      'single product status is 200': (r) => r.status === 200,
      'single product response time < 300ms': (r) => r.timings.duration < 300,
    }) || errorRate.add(1);
  }

  sleep(1);
}

export function handleSummary(data) {
  return {
    'performance-results.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const enableColors = options.enableColors || false;
  
  let summary = `
${indent}Performance Test Summary
${indent}========================
${indent}Duration: ${data.state.testRunDurationMs}ms
${indent}
${indent}Metrics:
${indent}  - HTTP Requests: ${data.metrics.http_reqs.values.count}
${indent}  - HTTP Request Duration (avg): ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
${indent}  - HTTP Request Duration (p95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
${indent}  - HTTP Request Duration (p99): ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms
${indent}  - HTTP Request Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
${indent}  - Iterations: ${data.metrics.iterations.values.count}
${indent}  - VUs (max): ${data.metrics.vus.values.max}
  `;
  
  return summary;
}
