/**
 * Runtime API proxy: forwards /api/* to BACKEND_URL.
 * BACKEND_URL is read from .env (or process.env) at request time.
 */

import { config as loadEnv } from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

// Load .env from frontend root (or cwd when running in Docker) so BACKEND_URL is available
loadEnv({ path: process.cwd() + '/.env' });
loadEnv({ path: process.cwd() + '/.env.local' });

function getBackendUrl(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8080'
  );
}

function backendPath(pathSegments: string[]): string {
  if (pathSegments.length === 0) return '/';
  // /api/auth/logout is under backend /api (requires Auth); other /api/auth/* -> backend /auth/*
  if (pathSegments[0] === 'auth' && pathSegments[1] === 'logout') {
    return `/api/auth/logout`;
  }
  if (pathSegments[0] === 'auth') {
    return `/auth/${pathSegments.slice(1).join('/')}`;
  }
  return `/api/${pathSegments.join('/')}`;
}

async function proxy(request: NextRequest, pathSegments: string[]) {
  const path = backendPath(pathSegments);
  const base = getBackendUrl().replace(/\/$/, '');
  const url = new URL(path, base);
  request.nextUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('connection');

  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      init.body = await request.text();
    } catch {
      // no body
    }
  }

  const res = await fetch(url.toString(), init);
  const body = await res.text();

  const responseHeaders = new Headers();
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'transfer-encoding') responseHeaders.set(key, value);
  });

  return new NextResponse(body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await context.params;
  return proxy(request, Array.isArray(path) ? path : [path]);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await context.params;
  return proxy(request, Array.isArray(path) ? path : [path]);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await context.params;
  return proxy(request, Array.isArray(path) ? path : [path]);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await context.params;
  return proxy(request, Array.isArray(path) ? path : [path]);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await context.params;
  return proxy(request, Array.isArray(path) ? path : [path]);
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path = [] } = await context.params;
  return proxy(request, Array.isArray(path) ? path : [path]);
}
