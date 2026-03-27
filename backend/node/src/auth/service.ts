import bcrypt from "bcrypt";
import crypto from "crypto";
import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { ConflictError, NotFoundError, UnauthorizedError } from "../lib/errors";
import { RegisterInput, LoginInput } from "./schemas";
import { config } from "../config";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateApiKey(): string {
  const prefix = "pdflow";
  const key = crypto.randomBytes(32).toString("base64url");
  return `${prefix}_${key}`;
}

function generateTokens(app: FastifyInstance, userId: string, email: string) {
  const accessToken = app.jwt.sign(
    { sub: userId, email },
    { expiresIn: config.JWT_ACCESS_EXPIRES }
  );
  const refreshToken = app.jwt.sign(
    { sub: userId, email, type: "refresh" },
    { expiresIn: config.JWT_REFRESH_EXPIRES }
  );
  return { accessToken, refreshToken };
}

export async function registerUser(app: FastifyInstance, input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError("A user with this email already exists");
  }

  const freePlan = await prisma.plan.findUnique({ where: { name: "free" } });
  if (!freePlan) {
    throw new Error("Free plan not found. Run seed script first.");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      planId: freePlan.id,
    },
    include: { plan: true },
  });

  const tokens = generateTokens(app, user.id, user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan.name,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
}

export async function loginUser(app: FastifyInstance, input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { plan: true },
  });

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const tokens = generateTokens(app, user.id, user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan.name,
      createdAt: user.createdAt,
    },
    ...tokens,
  };
}

export async function refreshTokens(app: FastifyInstance, refreshToken: string) {
  let payload: { sub: string; email: string; type?: string };
  try {
    payload = app.jwt.verify<{ sub: string; email: string; type?: string }>(refreshToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired refresh token");
  }

  if (payload.type !== "refresh") {
    throw new UnauthorizedError("Invalid token type");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { plan: true },
  });

  if (!user || user.refreshToken !== refreshToken) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const tokens = generateTokens(app, user.id, user.email);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: tokens.refreshToken },
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan.name,
    },
    ...tokens,
  };
}

export async function createApiKey(userId: string) {
  const apiKey = generateApiKey();

  const user = await prisma.user.update({
    where: { id: userId },
    data: { apiKey },
  });

  if (!user) {
    throw new NotFoundError("User", userId);
  }

  return { apiKey };
}

export async function revokeApiKey(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { apiKey: null },
  });
}

export async function getUserByApiKey(apiKey: string) {
  const user = await prisma.user.findUnique({
    where: { apiKey },
    include: { plan: true },
  });
  return user;
}
