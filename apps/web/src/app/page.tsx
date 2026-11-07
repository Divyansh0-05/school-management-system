'use client';

import React, { useEffect, useState } from 'react';
import type { HealthCheckResponse } from '@school/shared';

export default function HomePage() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [takingLong, setTakingLong] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    setTakingLong(false);

    const timer = setTimeout(() => {
      setTakingLong(true);
    }, 3000);

    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }
      const data: HealthCheckResponse = await res.json();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach API server');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          School Management System
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Full-Stack Modular Monolith — Phase 0 Bootstrap Status
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6 border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">
            Backend API Health Status
          </h2>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {loading && (
          <div className="py-8 text-center space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600" />
            <p className="text-sm text-slate-600">Connecting to API server...</p>
            {takingLong && (
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded inline-block max-w-md">
                Waking up the server... If hosted on a free cloud tier (e.g. Render), cold starts may take 30–60 seconds.
              </p>
            )}
          </div>
        )}

        {error && !loading && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-800 space-y-2">
            <p className="font-medium">Unable to connect to the backend API.</p>
            <p className="text-xs text-red-600">{error}</p>
            <p className="text-xs text-slate-500">
              Ensure the backend is running (`npm run dev` or `apps/api`) and reachable.
            </p>
          </div>
        )}

        {health && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase">Service Status</span>
              <div className="mt-1 flex items-center space-x-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    health.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="text-sm font-semibold capitalize text-slate-900">{health.status}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase">Database (Replica Set)</span>
              <div className="mt-1 flex items-center space-x-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    health.database.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm font-semibold capitalize text-slate-900">
                  {health.database.status} {health.database.replicaSet ? `(${health.database.replicaSet})` : ''}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase">Environment</span>
              <p className="mt-1 text-sm font-semibold text-slate-900">{health.environment}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded border border-slate-200">
              <span className="text-xs font-medium text-slate-500 uppercase">Version</span>
              <p className="mt-1 text-sm font-semibold text-slate-900">{health.version}</p>
            </div>

            <div className="p-4 bg-slate-50 rounded border border-slate-200 md:col-span-2">
              <span className="text-xs font-medium text-slate-500 uppercase">Server Timestamp</span>
              <p className="mt-1 text-xs font-mono text-slate-700">{health.timestamp}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-100 rounded-lg p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-700 mb-1">Phase 0 Bootstrap Verification</p>
        <p>Next.js App Router frontend successfully proxies API requests to Express backend (`/api/health`). Monorepo packages, shared Zod schemas, TypeScript strict configuration, and test tooling are active.</p>
      </div>
    </div>
  );
}

