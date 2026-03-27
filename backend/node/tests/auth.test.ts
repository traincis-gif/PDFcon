import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestApp, closeTestApp, createAuthHeader, registerTestUser } from "./setup";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await getTestApp();
});

afterAll(async () => {
  await closeTestApp();
});

describe("POST /auth/register", () => {
  it("should register a new user successfully", async () => {
    const { response, body } = await registerTestUser();
    expect(response.statusCode).toBe(201);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBeDefined();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.plan).toBe("free");
  });

  it("should reject duplicate email", async () => {
    const email = `dup-${Date.now()}@example.com`;
    await registerTestUser({ email });

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email, password: "TestPass123" },
    });

    expect(response.statusCode).toBe(409);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("should reject weak password", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "weak@example.com", password: "weak" },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject invalid email", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "not-an-email", password: "TestPass123" },
    });

    expect(response.statusCode).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("should login with correct credentials", async () => {
    const email = `login-${Date.now()}@example.com`;
    const password = "TestPass123";
    await registerTestUser({ email, password });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe(email);
  });

  it("should reject wrong password", async () => {
    const email = `wrong-${Date.now()}@example.com`;
    await registerTestUser({ email, password: "TestPass123" });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "WrongPass123" },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("should reject non-existent user", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ghost@example.com", password: "TestPass123" },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /auth/refresh", () => {
  it("should refresh tokens", async () => {
    const { body: regBody } = await registerTestUser();

    const response = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: regBody.refreshToken },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });
});

describe("POST /auth/api-key", () => {
  it("should generate an API key for authenticated user", async () => {
    const { body: regBody } = await registerTestUser();

    const response = await app.inject({
      method: "POST",
      url: "/auth/api-key",
      headers: createAuthHeader(regBody.accessToken),
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.apiKey).toBeDefined();
    expect(body.apiKey).toMatch(/^pdflow_/);
  });

  it("should reject unauthenticated request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/api-key",
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("GET /auth/me", () => {
  it("should return current user profile", async () => {
    const { body: regBody, email } = await registerTestUser();

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: createAuthHeader(regBody.accessToken),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.email).toBe(email);
    expect(body.plan).toBe("free");
  });
});
