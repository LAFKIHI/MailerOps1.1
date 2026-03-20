import type { Server } from './types';

type EntityWithMaybeMongoId = {
  id?: string | null;
  _id?: string | null;
};

export function normalizeEntityId(entity: EntityWithMaybeMongoId | null | undefined): string {
  return String(entity?.id ?? entity?._id ?? '').trim();
}

export function getServerId(server: (Partial<Server> & EntityWithMaybeMongoId) | null | undefined): string {
  return normalizeEntityId(server);
}

export function getServerRdp(server: Partial<Server> | null | undefined): string {
  return String(server?.rdp ?? server?.group ?? '').trim();
}
