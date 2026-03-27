import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../lib/prisma";
import { UnauthorizedError } from "../lib/errors";
import { getUserByApiKey } from "../auth/service";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    user?: any;
    userPlan?: any;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError("Missing authorization header");
  }

  // API key auth: "Bearer pdflow_..."
  if (authHeader.startsWith("Bearer pdflow_")) {
    const apiKey = authHeader.replace("Bearer ", "");
    const user = await getUserByApiKey(apiKey);
    if (!user) {
      throw new UnauthorizedError("Invalid API key");
    }
    request.userId = user.id;
    request.user = user;
    request.userPlan = user.plan;
    return;
  }

  // JWT auth: "Bearer eyJ..."
  if (authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.replace("Bearer ", "");
      const decoded = request.server.jwt.verify<{ sub: string; email: string; type?: string }>(token);

      if (decoded.type === "refresh") {
        throw new UnauthorizedError("Cannot use refresh token for authentication");
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        include: { plan: true },
      });

      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      request.userId = user.id;
      request.user = user;
      request.userPlan = user.plan;
      return;
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err;
      throw new UnauthorizedError("Invalid or expired token");
    }
  }

  throw new UnauthorizedError("Invalid authorization format. Use 'Bearer <token>' or 'Bearer <api-key>'");
}
