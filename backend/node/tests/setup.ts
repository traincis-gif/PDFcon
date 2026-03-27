import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";

let app: FastifyInstance;

export async function getTestApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function closeTestApp() {
  if (app) {
    await app.close();
  }
}

export function createAuthHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

// Helper to register a test user and return tokens
export async function registerTestUser(
  overrides: { email?: string; password?: string } = {}
) {
  const testApp = await getTestApp();
  const email = overrides.email || `test-${Date.now()}@example.com`;
  const password = overrides.password || "TestPass123";

  const response = await testApp.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, password },
  });

  return {
    response,
    body: JSON.parse(response.body),
    email,
    password,
  };
}
