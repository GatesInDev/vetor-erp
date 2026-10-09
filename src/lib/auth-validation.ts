import { z } from "zod";

export const loginSchema = z.object({ email: z.email().max(320), password: z.string().min(1).max(1024) });
export const refreshTokenSchema = z.object({ refreshToken: z.string().regex(/^[A-Za-z0-9_-]{64}$/) });
