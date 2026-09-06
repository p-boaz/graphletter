"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ProviderHealth {
  provider: string;
  status: "healthy" | "recovering" | "tripped";
  consecutiveFailures: number;
  lastFailureAt: string | null;
  trippedAt: string | null;
  secondsUntilAutoReset: number | null;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  return new Date(value).toLocaleString();
}

function statusBadgeClass(status: ProviderHealth["status"]): string {
  if (status === "healthy") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "recovering") {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-red-100 text-red-800";
}

export default function AIProviderHealthAdminPage() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/ai-provider-health", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        providers?: ProviderHealth[];
        fetchedAt?: string;
      };

      if (response.status === 401) {
        setError("Unauthorized. Sign in with an admin account.");
        setProviders([]);
        return;
      }

      if (response.status === 403) {
        setError("Forbidden. Admin access required.");
        setProviders([]);
        return;
      }

      if (!response.ok) {
        setError(payload.error || "Failed to load provider health.");
        setProviders([]);
        return;
      }

      setProviders(payload.providers || []);
      setFetchedAt(payload.fetchedAt || null);
    } catch {
      setError("Failed to load provider health.");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  return (
    <div className="mx-auto max-w-5xl p-8" data-testid="admin-ai-provider-health-page">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl text-slate-900">AI Provider Health</h1>
          <p className="mt-1 text-slate-600 text-sm">
            Circuit breaker state for configured AI providers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadHealth()}
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 text-sm hover:bg-slate-50"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 text-sm hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {fetchedAt && !error && (
        <p className="mb-4 text-slate-500 text-xs">
          Last updated: {new Date(fetchedAt).toLocaleString()}
        </p>
      )}

      {error && (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700 text-sm"
          data-testid="admin-ai-provider-health-error"
        >
          {error}
        </div>
      )}

      {!error && !loading && providers.length === 0 && (
        <div
          className="rounded-md border border-slate-200 bg-white p-6 text-center text-slate-600 text-sm"
          data-testid="admin-ai-provider-health-empty"
        >
          No provider health rows found.
        </div>
      )}

      {!error && providers.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table
            className="min-w-full divide-y divide-slate-200"
            data-testid="admin-ai-provider-health-table"
          >
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Provider
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Consecutive Failures
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Last Failure
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Tripped At
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 text-xs uppercase tracking-wide">
                  Auto Reset (s)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {providers.map((provider) => (
                <tr
                  key={provider.provider}
                  data-testid={`admin-ai-provider-health-row-${provider.provider}`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900 text-sm">
                    {provider.provider}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 font-medium text-xs ${statusBadgeClass(provider.status)}`}
                    >
                      {provider.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-sm">
                    {provider.consecutiveFailures}
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-sm">
                    {formatTimestamp(provider.lastFailureAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-sm">
                    {formatTimestamp(provider.trippedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-700 text-sm">
                    {provider.secondsUntilAutoReset ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
