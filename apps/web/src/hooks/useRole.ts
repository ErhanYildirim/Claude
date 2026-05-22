import { useState, useEffect } from "react";
import { api } from "../lib/api.js";

export type Role = "owner" | "admin" | "analyst" | "viewer";

const ROLE_RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2, owner: 3 };

let cached: Role | null = null;
const listeners: Array<(r: Role | null) => void> = [];

function notify(role: Role | null) {
  cached = role;
  listeners.forEach(fn => fn(role));
}

export function useRole() {
  const [role, setRole] = useState<Role | null>(cached);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    listeners.push(setRole);
    if (cached === null) {
      api.members.me()
        .then(r => notify(r.role as Role))
        .catch(() => notify(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => {
      const idx = listeners.indexOf(setRole);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }, []);

  function atLeast(minRole: Role): boolean {
    if (!role) return false;
    return ROLE_RANK[role] >= ROLE_RANK[minRole];
  }

  return { role, loading, atLeast };
}

export function invalidateRoleCache() {
  cached = null;
}
