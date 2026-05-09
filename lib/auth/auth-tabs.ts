export type AuthTab = "signin" | "signup";

const VALID: readonly AuthTab[] = ["signin", "signup"] as const;

export function parseAuthTab(raw: string | undefined): AuthTab {
  return VALID.includes(raw as AuthTab) ? (raw as AuthTab) : "signin";
}

export function authUrl(tab: AuthTab = "signin", next?: string): string {
  const params = new URLSearchParams();
  if (tab !== "signin") params.set("tab", tab);
  if (next) params.set("next", next);
  const qs = params.toString();
  return qs ? `/auth?${qs}` : "/auth";
}
