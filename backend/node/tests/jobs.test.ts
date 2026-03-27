import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTestApp, closeTestApp, createAuthHeader, registerTestUser } from "./setup";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let authToken: string;
let userId: string;

beforeAll(async () => {
  app = await getTestApp();
  const { body } = await registerTestUser();
  authToken = body.accessToken;
  userId = body.user.id;
});

afterAll(async () => {
  await closeTestApp();
});

describe("POST /jobs", () => {
  it("should create a merge job", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: createAuthHeader(authToken),
      payload: {
        type: "MERGE",
        metadata: {
          fileKeys: ["uploads/test/file1.pdf", "uploads/test/file2.pdf"],
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.type).toBe("MERGE");
    expect(body.status).toBe("PENDING");
    expect(body.userId).toBe(userId);
  });

  it("should create a compress job", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: createAuthHeader(authToken),
      payload: {
        type: "COMPRESS",
        metadata: {
          fileKeys: ["uploads/test/file1.pdf"],
          quality: "high",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.type).toBe("COMPRESS");
  });

  it("should create a split job", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: createAuthHeader(authToken),
      payload: {
        type: "SPLIT",
        metadata: {
          fileKeys: ["uploads/test/file1.pdf"],
          pages: "1-3,5",
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.type).toBe("SPLIT");
  });

  it("should create a PDF to PNG job", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: createAuthHeader(authToken),
      payload: {
        type: "PDF_TO_PNG",
        metadata: {
          fileKeys: ["uploads/test/file1.pdf"],
          dpi: 300,
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.type).toBe("PDF_TO_PNG");
  });

  it("should reject invalid job type", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: createAuthHeader(authToken),
      payload: {
        type: "INVALID",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject unauthenticated request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      payload: { type: "MERGE" },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe("GET /jobs", () => {
  it("should list user jobs", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/jobs",
      headers: createAuthHeader(authToken),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.jobs).toBeDefined();
    expect(Array.isArray(body.jobs)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.total).toBeGreaterThan(0);
  });

  it("should filter by status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/jobs?status=PENDING",
      headers: createAuthHeader(authToken),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    for (const job of body.jobs) {
      expect(job.status).toBe("PENDING");
    }
  });

  it("should filter by type", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/jobs?type=MERGE",
      headers: createAuthHeader(authToken),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    for (const job of body.jobs) {
      expect(job.type).toBe("MERGE");
    }
  });

  it("should paginate results", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/jobs?page=1&limit=2",
      headers: createAuthHeader(authToken),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.jobs.length).toBeLessThanOrEqual(2);
    expect(body.pagination.limit).toBe(2);
  });
});

describe("GET /jobs/:id", () => {
  it("should get a specific job", async () => {
    // Create a job first
    const createRes = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: createAuthHeader(authToken),
      payload: {
        type: "COMPRESS",
        metadata: { fileKeys: ["uploads/test/file.pdf"], quality: "low" },
      },
    });
    const created = JSON.parse(createRes.body);

    const response = await app.inject({
      method: "GET",
      url: `/jobs/${created.id}`,
      headers: createAuthHeader(authToken),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(created.id);
    expect(body.type).toBe("COMPRESS");
  });

  it("should return 404 for non-existent job", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/jobs/00000000-0000-0000-0000-000000000000",
      headers: createAuthHeader(authToken),
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});

describe("DELETE /jobs/:id (cancel)", () => {
  it("should cancel a pending job", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/jobs",
      headers: createAuthHeader(authToken),
      payload: {
        type: "MERGE",
        metadata: { fileKeys: ["uploads/test/a.pdf", "uploads/test/b.pdf"] },
      },
    });
    const created = JSON.parse(createRes.body);

    const response = await app.inject({
      method: "DELETE",
      url: `/jobs/${created.id}`,
      headers: createAuthHeader(authToken),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("FAILED");
    expect(body.errorMessage).toBe("Cancelled by user");
  });
});

describe("GET /health", () => {
  it("should return health status", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
    expect(body.uptime).toBeDefined();
  });
});

describe("GET /jobs/usage/stats", () => {
  it("should return usage stats", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/jobs/usage/stats",
      headers: createAuthHeader(authToken),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.totalJobs).toBeDefined();
    expect(body.monthlyUsage).toBeDefined();
    expect(body.byType).toBeDefined();
  });
});
