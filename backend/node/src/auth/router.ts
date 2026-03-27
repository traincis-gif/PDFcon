import { FastifyInstance } from "fastify";
import { registerSchema, loginSchema, refreshSchema } from "./schemas";
import { registerUser, loginUser, refreshTokens, createApiKey, revokeApiKey } from "./service";
import { authenticate } from "../middleware/auth";

export async function authRouter(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const result = await registerUser(app, body);
    return reply.status(201).send(result);
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await loginUser(app, body);
    return reply.send(result);
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const result = await refreshTokens(app, body.refreshToken);
    return reply.send(result);
  });

  app.post(
    "/auth/api-key",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request as any).userId as string;
      const result = await createApiKey(userId);
      return reply.status(201).send(result);
    }
  );

  app.delete(
    "/auth/api-key",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = (request as any).userId as string;
      await revokeApiKey(userId);
      return reply.status(204).send();
    }
  );

  app.get(
    "/auth/me",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const user = (request as any).user;
      return reply.send({
        id: user.id,
        email: user.email,
        plan: user.plan?.name,
        apiKey: user.apiKey ? `${user.apiKey.slice(0, 12)}...` : null,
        createdAt: user.createdAt,
      });
    }
  );
}
