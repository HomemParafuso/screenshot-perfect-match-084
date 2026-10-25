import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) return reply.status(400).send({ error: "validation_error", issues: err.issues });
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.code, message: err.message });
    const e = err as any;
    if (e.code === "23505") return reply.status(409).send({ error: "conflict" });
    if (e.code === "23503") return reply.status(400).send({ error: "invalid_reference" });
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: e.code ?? "bad_request", message: e.message });
    req.log.error(err);
    return reply.status(500).send({ error: "internal_error" });
  });
}
