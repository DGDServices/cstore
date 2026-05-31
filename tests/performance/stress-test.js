import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Stress test configuration - increase load until system breaks
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 200 }, // Increase to 200 users
    { duration: '5m', target: 300 }, // Increase to 300 users
    { duration: '5m', target: 400 }, // Increase to 400 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // Allow higher response times
    http_req_failed: ['rate<0.2'], // Allow higher error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Simulate various user actions
  const scenarios = [
    testHealth,
    testProducts,
    testAuth,
    testOrders,
  ];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  scenario();

  sleep(Math.random() * 3);
}

function testHealth() {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, {
    'health check status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);
}

function testProducts() {
  const res = http.get(`${BASE_URL}/api/products`);
  check(res, {
    'products status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  }) || errorRate.add(1);
}

function testAuth() {
  const payload = JSON.stringify({
    email: `test${Math.floor(Math.random() * 1000)}@example.com`,
    password: 'testpassword123',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/auth/login`, payload, params);
  check(res, {
    'auth status is 200, 401, or 503': (r) => 
      r.status === 200 || r.status === 401 || r.status === 503,
  }) || errorRate.add(1);
}

function testOrders() {
  const res = http.get(`${BASE_URL}/api/orders`);
  check(res, {
    'orders status is 200, 401, or 503': (r) => 
      r.status === 200 || r.status === 401 || r.status === 503,
  }) || errorRate.add(1);
}

export function handleSummary(data) {
  const maxVUs = data.metrics.vus.values.max;
  const avgResponseTime = data.metrics.http_req_duration.values.avg;
  const errorRate = data.metrics.http_req_failed.values.rate;

  console.log(`
Stress Test Results:
====================
Maximum Concurrent Users: ${maxVUs}
Average Response Time: ${avgResponseTime.toFixed(2)}ms
Error Rate: ${(errorRate * 100).toFixed(2)}%
System Breaking Point: ${errorRate > 0.5 ? 'REACHED' : 'NOT REACHED'}
  `);

  return {
    'stress-results.json': JSON.stringify(data, null, 2),
  };
}
