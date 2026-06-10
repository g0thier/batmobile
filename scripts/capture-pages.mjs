import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';
import ts from 'typescript';

const PROJECT_ROOT = process.cwd();
const ROUTES_FILE = path.join(PROJECT_ROOT, 'src', 'app', 'app.routes.ts');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs', 'images');

function parseEnvFile(content) {
  const env = {};

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = await fs.readFile(filePath, 'utf8');
  const fileEnv = parseEnvFile(content);

  for (const [key, value] of Object.entries(fileEnv)) {
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

function getRuntimeConfig() {
  return {
    baseUrl: process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:4173',
    devCommand:
      process.env.SCREENSHOT_DEV_COMMAND || 'npm run start -- --host 127.0.0.1 --port 4173',
    autoStartServer: process.env.SCREENSHOT_AUTO_START !== 'false',
    loginPath: process.env.SCREENSHOT_LOGIN_PATH || '/login',
    includeDynamicRoutes: process.env.SCREENSHOT_INCLUDE_DYNAMIC === 'true',
    extraRoutes: (process.env.SCREENSHOT_EXTRA_ROUTES || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    authEmail: process.env.SCREENSHOT_AUTH_EMAIL || '',
    authPassword: process.env.SCREENSHOT_AUTH_PASSWORD || '',
  };
}

async function waitForHttpReady(url, timeoutMs = 45000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok || response.status === 404) {
        return;
      }
    } catch {
      // The server is not ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Serveur indisponible après ${timeoutMs}ms: ${url}`);
}

function normalizeRoute(route) {
  const trimmed = route.trim();
  if (!trimmed) {
    return null;
  }

  const withoutTrailingSlash = trimmed.replace(/\/$/u, '');
  if (!withoutTrailingSlash) {
    return '/';
  }

  if (withoutTrailingSlash.startsWith('/')) {
    return withoutTrailingSlash;
  }

  return `/${withoutTrailingSlash}`;
}

function joinRoutes(basePath, childPath) {
  const parent = normalizeRoute(basePath);
  const child = childPath.trim().replace(/^\/+|\/+$/gu, '');

  if (!parent || parent === '/') {
    return normalizeRoute(child || '/');
  }

  if (!child) {
    return parent;
  }

  return normalizeRoute(`${parent}/${child}`);
}

function isDynamicRoute(route) {
  return route.includes(':') || route.includes('*');
}

function isIgnorableRoute(route) {
  return (
    route === '/' ||
    route === '/login' ||
    route === '/reset-password' ||
    route === '/tabs/quiz-session'
  );
}

function sanitizeSegment(segment) {
  return (
    segment
      .replace(/^:/u, 'param-')
      .replace(/[^a-zA-Z0-9._-]+/gu, '-')
      .replace(/-+/gu, '-')
      .replace(/^-|-$/gu, '') || 'index'
  );
}

function routeToOutputPath(route) {
  const normalized = route.replace(/\/$/u, '');

  if (!normalized || normalized === '/') {
    return path.join(OUTPUT_DIR, 'index.png');
  }

  const segments = normalized
    .replace(/^\//u, '')
    .split('/')
    .map((segment) => sanitizeSegment(segment));

  const fileName = `${segments.pop()}.png`;
  return path.join(OUTPUT_DIR, ...segments, fileName);
}

async function ensureDirForFile(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

function unwrapExpression(expression) {
  let current = expression;
  while (ts.isParenthesizedExpression(current) || ts.isAsExpression(current)) {
    current = current.expression;
  }

  return current;
}

function getPropertyNameText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function getObjectPropertyInitializer(objectLiteral, propertyName) {
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property)) {
      continue;
    }

    const nameText = getPropertyNameText(property.name);
    if (nameText === propertyName) {
      return property.initializer;
    }
  }

  return null;
}

function getRoutePath(objectLiteral) {
  const initializer = getObjectPropertyInitializer(objectLiteral, 'path');
  if (!initializer) {
    return null;
  }

  const unwrapped = unwrapExpression(initializer);
  if (ts.isStringLiteralLike(unwrapped)) {
    return unwrapped.text;
  }

  return null;
}

function getChildRoutes(objectLiteral) {
  const initializer = getObjectPropertyInitializer(objectLiteral, 'children');
  if (!initializer) {
    return null;
  }

  const unwrapped = unwrapExpression(initializer);
  if (ts.isArrayLiteralExpression(unwrapped)) {
    return unwrapped;
  }

  return null;
}

function hasRedirectTo(objectLiteral) {
  return Boolean(getObjectPropertyInitializer(objectLiteral, 'redirectTo'));
}

function collectRoutesFromArray(arrayLiteral, basePath, config, collectedRoutes) {
  for (const element of arrayLiteral.elements) {
    const routeNode = unwrapExpression(element);
    if (!ts.isObjectLiteralExpression(routeNode)) {
      continue;
    }

    const rawPath = getRoutePath(routeNode);
    if (rawPath === null) {
      continue;
    }

    const childRoutes = getChildRoutes(routeNode);
    const fullPath = joinRoutes(basePath, rawPath);

    if (childRoutes) {
      collectRoutesFromArray(childRoutes, fullPath, config, collectedRoutes);
      continue;
    }

    if (hasRedirectTo(routeNode)) {
      continue;
    }

    const normalized = normalizeRoute(fullPath);
    if (!normalized || isIgnorableRoute(normalized)) {
      continue;
    }

    if (!config.includeDynamicRoutes && isDynamicRoute(normalized)) {
      continue;
    }

    collectedRoutes.add(normalized);
  }
}

async function discoverRoutes(config) {
  const source = await fs.readFile(ROUTES_FILE, 'utf8');
  const sourceFile = ts.createSourceFile(ROUTES_FILE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const collectedRoutes = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'routes') {
        continue;
      }

      if (!declaration.initializer) {
        continue;
      }

      const initializer = unwrapExpression(declaration.initializer);
      if (ts.isArrayLiteralExpression(initializer)) {
        collectRoutesFromArray(initializer, '', config, collectedRoutes);
      }
    }
  }

  for (const extraRoute of config.extraRoutes) {
    const normalized = normalizeRoute(extraRoute);
    if (normalized && !isIgnorableRoute(normalized)) {
      collectedRoutes.add(normalized);
    }
  }

  return [...collectedRoutes].sort((a, b) => a.localeCompare(b));
}

function isLoginUrl(urlString, loginPath) {
  const url = new URL(urlString);
  const pathname = url.pathname.replace(/\/$/u, '') || '/';
  const normalizedLoginPath = loginPath.replace(/\/$/u, '') || '/';
  return pathname === normalizedLoginPath;
}

async function performLogin(page, config) {
  await page.goto(new URL(config.loginPath, config.baseUrl).toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.waitForSelector('input[name="email"]', { timeout: 15000 });
  await page.fill('input[name="email"]', config.authEmail);
  await page.locator('button[type="submit"]:visible').click();

  await page.waitForSelector('input[name="password"]', { timeout: 15000 });
  await page.fill('input[name="password"]', config.authPassword);
  await page.locator('button[type="submit"]:visible').click();

  try {
    await page.waitForURL((url) => !isLoginUrl(url.toString(), config.loginPath), { timeout: 15000 });
  } catch {
    // Some flows update state without changing the URL immediately.
  }

  await page.waitForTimeout(1500);

  if (isLoginUrl(page.url(), config.loginPath)) {
    const loginErrorText = await page
      .locator('.auth-error')
      .first()
      .textContent()
      .catch(() => '');

    if (loginErrorText && loginErrorText.trim()) {
      throw new Error(
        `La connexion n’a pas abouti: ${loginErrorText.trim()}`
      );
    }

    throw new Error('La connexion n’a pas abouti: la page de login est restée affichée.');
  }
}

async function captureRoutes() {
  await loadDotEnvFile(path.join(PROJECT_ROOT, '.env.local'));
  const config = getRuntimeConfig();

  if (!config.authEmail || !config.authPassword) {
    throw new Error(
      'SCREENSHOT_AUTH_EMAIL et SCREENSHOT_AUTH_PASSWORD sont requis pour capturer les pages protégées.'
    );
  }

  const routes = await discoverRoutes(config);
  if (routes.length === 0) {
    throw new Error('Aucune route capturable trouvée dans src/app/app.routes.ts.');
  }

  console.log(`Routes découvertes (${routes.length}) :`);
  for (const route of routes) {
    console.log(`- ${route}`);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    throw new Error(
      [
        'Playwright est requis pour les captures.',
        'Installez-le avec:',
        '  npm i -D playwright',
        'Puis installez Chromium avec:',
        '  npx playwright install chromium',
      ].join('\n')
    );
  }

  let devServerProcess;
  let browser;

  try {
    if (config.autoStartServer) {
      console.log(`Démarrage du serveur: ${config.devCommand}`);
      devServerProcess = spawn('/bin/zsh', ['-lc', config.devCommand], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
    }

    await waitForHttpReady(config.baseUrl);
    console.log(`Serveur prêt sur ${config.baseUrl}`);

    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage();

    console.log('Connexion en cours...');
    await performLogin(page, config);
    console.log('Connexion réussie.');

    const captured = [];
    const skipped = [];

    for (const route of routes) {
      const targetUrl = new URL(route, config.baseUrl).toString();
      console.log(`Capture ${route}`);

      try {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);

        if (isLoginUrl(page.url(), config.loginPath)) {
          skipped.push({ route, reason: 'Route redirigée vers la page de connexion' });
          continue;
        }

        const outputPath = routeToOutputPath(route);
        await ensureDirForFile(outputPath);
        await page.screenshot({ path: outputPath, fullPage: true });
        captured.push({ route, outputPath });
      } catch (error) {
        skipped.push({ route, reason: error instanceof Error ? error.message : String(error) });
      }
    }

    console.log('\nCaptures générées :');
    for (const item of captured) {
      console.log(`- ${item.route} -> ${path.relative(PROJECT_ROOT, item.outputPath)}`);
    }

    if (skipped.length > 0) {
      console.log('\nRoutes ignorées/échouées :');
      for (const item of skipped) {
        console.log(`- ${item.route}: ${item.reason}`);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }

    if (devServerProcess) {
      devServerProcess.kill('SIGTERM');
    }
  }
}

captureRoutes().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
