import type { ActorType } from "../services/auth.service";

declare global {
  namespace Express {
    interface Request {
      actor?: {
        id: string;
        tenantId: string | null;
        actorType: ActorType;
        retailerId: string | null;
      };
    }
  }
}

export {};
