<?php

declare(strict_types=1);

const DEFAULT_BOARD_SLUG = 'omri-pilot';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
}

function storePath(): string
{
    $configured = getenv('FHINKAI_SYNC_BOARD_STORE');
    if (is_string($configured) && trim($configured) !== '') {
        return $configured;
    }

    $dir = basename(__DIR__) === 'public_html' ? dirname(__DIR__) : __DIR__;
    return $dir . DIRECTORY_SEPARATOR . '.fhinkai-sync-boards.json';
}

function defaultPayload(): array
{
    return [
        'title' => 'לוח סנכרון - פיילוט עומרי',
        'description' => 'לוח עבודה משותף לצוות הפיילוט. מעדכנים רק את מה שצריך כדי שהחלטות, חסימות ואחריות לא ייפלו בין הכיסאות.',
        'columns' => [
            [
                'id' => 'todo',
                'title' => 'לבדיקה',
                'color' => 'amber',
                'items' => [
                    [
                        'id' => 'seed-1',
                        'title' => 'להכריע איזה יום 1 עולה לפרודקשן',
                        'owner' => 'גיא',
                        'due' => '',
                        'notes' => 'READY החדש חי. day1 החדש עדיין לא מחובר.',
                        'updatedAt' => gmdate('c'),
                    ],
                ],
            ],
            [
                'id' => 'doing',
                'title' => 'בתהליך',
                'color' => 'blue',
                'items' => [
                    [
                        'id' => 'seed-2',
                        'title' => 'איסוף לידים וחימום לקראת 14/6',
                        'owner' => 'עומרי',
                        'due' => '2026-06-14',
                        'notes' => 'הנעילה של pilot מכוונת ולא באג.',
                        'updatedAt' => gmdate('c'),
                    ],
                ],
            ],
            [
                'id' => 'done',
                'title' => 'סגור',
                'color' => 'green',
                'items' => [
                    [
                        'id' => 'seed-3',
                        'title' => 'אימות שהנעילה עד 7/6 תקינה',
                        'owner' => 'גיא',
                        'due' => '',
                        'notes' => 'אומת בקוד. לא פותחים את האתגר לפני ההחלטה העסקית.',
                        'updatedAt' => gmdate('c'),
                    ],
                ],
            ],
        ],
        'notes' => [
            'general' => 'המטרה: לראות מצב אמת במקום אחד.',
            'omri' => 'המערכת נעולה בכוונה. הפער כרגע הוא סנכרון ציפיות ועיצוב.',
            'guy' => 'לא משנים gate בלי החלטה עסקית.',
        ],
    ];
}

function readBoards(string $path): array
{
    if (!is_file($path)) {
        return [];
    }

    $json = file_get_contents($path);
    if (!is_string($json) || trim($json) === '') {
        return [];
    }

    $decoded = json_decode($json, true);
    return is_array($decoded) ? $decoded : [];
}

function writeBoards(string $path, array $boards): void
{
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
        respond(500, ['error' => 'store directory unavailable']);
    }

    $tmp = $path . '.tmp';
    $json = json_encode($boards, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (!is_string($json) || file_put_contents($tmp, $json, LOCK_EX) === false) {
        respond(500, ['error' => 'failed writing board store']);
    }

    if (!rename($tmp, $path)) {
        @unlink($tmp);
        respond(500, ['error' => 'failed committing board store']);
    }
}

function requestJson(): array
{
    $body = file_get_contents('php://input');
    $decoded = json_decode(is_string($body) ? $body : '', true);
    return is_array($decoded) ? $decoded : [];
}

function cleanSlug(string $slug): string
{
    $slug = preg_replace('/[^a-z0-9_-]/i', '', $slug) ?? '';
    return $slug !== '' ? $slug : DEFAULT_BOARD_SLUG;
}

function hashKey(string $key): string
{
    return hash('sha256', $key);
}

function requireKey(array $input): string
{
    $key = trim((string)($input['key'] ?? ($_GET['key'] ?? '')));
    if (strlen($key) < 24) {
        respond(401, ['error' => 'missing or weak board key']);
    }
    return $key;
}

function sanitizePayload(mixed $payload): array
{
    if (!is_array($payload)) {
        respond(400, ['error' => 'payload must be an object']);
    }

    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || strlen($encoded) > 200000) {
        respond(400, ['error' => 'payload too large']);
    }

    return $payload;
}

cors();

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    respond(200, ['ok' => true]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = $method === 'POST' ? requestJson() : [];
$slug = cleanSlug((string)($input['slug'] ?? ($_GET['slug'] ?? DEFAULT_BOARD_SLUG)));
$key = requireKey($input);
$path = storePath();
$boards = readBoards($path);
$now = gmdate('c');

if (!isset($boards[$slug])) {
    $boards[$slug] = [
        'slug' => $slug,
        'keyHash' => hashKey($key),
        'payload' => defaultPayload(),
        'updatedBy' => 'system',
        'createdAt' => $now,
        'updatedAt' => $now,
    ];
    writeBoards($path, $boards);
}

if (!hash_equals((string)$boards[$slug]['keyHash'], hashKey($key))) {
    respond(401, ['error' => 'unauthorized']);
}

if ($method === 'GET') {
    respond(200, [
        'slug' => $slug,
        'payload' => $boards[$slug]['payload'] ?? defaultPayload(),
        'updated_by' => $boards[$slug]['updatedBy'] ?? null,
        'created_at' => $boards[$slug]['createdAt'] ?? null,
        'updated_at' => $boards[$slug]['updatedAt'] ?? null,
    ]);
}

if ($method !== 'POST') {
    respond(405, ['error' => 'method not allowed']);
}

$boards[$slug]['payload'] = sanitizePayload($input['payload'] ?? null);
$boards[$slug]['updatedBy'] = trim((string)($input['updatedBy'] ?? '')) ?: null;
$boards[$slug]['updatedAt'] = $now;
writeBoards($path, $boards);

respond(200, [
    'slug' => $slug,
    'payload' => $boards[$slug]['payload'],
    'updated_by' => $boards[$slug]['updatedBy'],
    'created_at' => $boards[$slug]['createdAt'] ?? $now,
    'updated_at' => $boards[$slug]['updatedAt'],
]);
