<?php

declare(strict_types=1);

const REPO_ZIP_URL = 'https://github.com/guycoful/fhinkai-site/archive/refs/heads/master.zip';
const REPO_REF_API_URL = 'https://api.github.com/repos/guycoful/fhinkai-site/git/ref/heads/master';
const WEB_ROOT = '/home/fhinkaic/public_html';
const STATE_FILE = '/home/fhinkaic/.fhinkai-site-deploy-state.json';
const LOCK_FILE = '/home/fhinkaic/.fhinkai-site-deploy.lock';

const PRESERVE_TOP_LEVEL = [
    '.htaccess',
    '.well-known',
    'cgi-bin',
    'cpanel-deploy.php',
];

function logLine(string $message): void
{
    fwrite(STDOUT, '[' . gmdate('Y-m-d H:i:s') . ' UTC] ' . $message . PHP_EOL);
}

function fail(string $message): never
{
    logLine('ERROR: ' . $message);
    exit(1);
}

function request(string $url): string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_USERAGENT => 'fhinkai-site-cpanel-deploy/1.0',
        CURLOPT_FAILONERROR => false,
    ]);

    $body = curl_exec($ch);
    $error = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if (!is_string($body) || $body === false || $status < 200 || $status >= 300) {
        throw new RuntimeException("HTTP request failed for {$url}; status={$status}; error={$error}");
    }

    return $body;
}

function remoteSha(): ?string
{
    try {
        $payload = json_decode(request(REPO_REF_API_URL), true, 512, JSON_THROW_ON_ERROR);
        $sha = $payload['object']['sha'] ?? null;

        return is_string($sha) && $sha !== '' ? $sha : null;
    } catch (Throwable $e) {
        logLine('Unable to read remote SHA; continuing with zip download. ' . $e->getMessage());
        return null;
    }
}

function readState(): array
{
    if (!is_file(STATE_FILE)) {
        return [];
    }

    try {
        $state = json_decode((string) file_get_contents(STATE_FILE), true, 512, JSON_THROW_ON_ERROR);
        return is_array($state) ? $state : [];
    } catch (Throwable) {
        return [];
    }
}

function writeState(?string $sha): void
{
    $state = [
        'sha' => $sha,
        'deployed_at' => gmdate('c'),
    ];

    file_put_contents(STATE_FILE, json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
}

function rrmdir(string $path): void
{
    if (!is_dir($path)) {
        return;
    }

    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );

    foreach ($items as $item) {
        $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    }

    rmdir($path);
}

function topLevelName(string $relativePath): string
{
    $relativePath = str_replace('\\', '/', ltrim($relativePath, '/'));
    return explode('/', $relativePath, 2)[0] ?? $relativePath;
}

function shouldPreserve(string $relativePath): bool
{
    return in_array(topLevelName($relativePath), PRESERVE_TOP_LEVEL, true);
}

function cleanWebRoot(string $webRoot): int
{
    $deleted = 0;
    $rootReal = realpath($webRoot);

    if ($rootReal === false) {
        throw new RuntimeException("Unable to resolve web root: {$webRoot}");
    }

    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($webRoot, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );

    foreach ($items as $item) {
        $path = $item->getPathname();
        $relative = ltrim(str_replace('\\', '/', substr($path, strlen($rootReal))), '/');

        if ($relative === '' || shouldPreserve($relative)) {
            continue;
        }

        if ($item->isDir()) {
            @rmdir($path);
            continue;
        }

        unlink($path);
        $deleted++;
    }

    return $deleted;
}

function copyTree(string $sourceDir, string $webRoot): int
{
    $copied = 0;
    $items = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($sourceDir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($items as $item) {
        $sourcePath = $item->getPathname();
        $relative = str_replace('\\', '/', substr($sourcePath, strlen($sourceDir) + 1));

        if ($relative === '' || topLevelName($relative) === '.github' || topLevelName($relative) === '.git') {
            continue;
        }

        $targetPath = $webRoot . DIRECTORY_SEPARATOR . $relative;

        if ($item->isDir()) {
            if (!is_dir($targetPath) && !mkdir($targetPath, 0755, true)) {
                throw new RuntimeException("Unable to create directory: {$relative}");
            }
            continue;
        }

        $parent = dirname($targetPath);
        if (!is_dir($parent) && !mkdir($parent, 0755, true)) {
            throw new RuntimeException("Unable to create directory: {$parent}");
        }

        if (!copy($sourcePath, $targetPath)) {
            throw new RuntimeException("Unable to copy file: {$relative}");
        }

        chmod($targetPath, 0644);
        $copied++;
    }

    return $copied;
}

function extractZip(string $zipPath, string $targetDir): string
{
    $zip = new ZipArchive();

    if ($zip->open($zipPath) !== true) {
        throw new RuntimeException('Unable to open repository zip.');
    }

    if (!$zip->extractTo($targetDir)) {
        $zip->close();
        throw new RuntimeException('Unable to extract repository zip.');
    }

    $zip->close();

    $dirs = glob($targetDir . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR);
    if (!is_array($dirs) || count($dirs) !== 1) {
        throw new RuntimeException('Unexpected GitHub zip structure.');
    }

    return $dirs[0];
}

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "CLI only\n";
    exit(1);
}

$lock = fopen(LOCK_FILE, 'c');
if ($lock === false) {
    fail('Unable to open lock file.');
}

if (!flock($lock, LOCK_EX | LOCK_NB)) {
    logLine('Another deployment is already running.');
    exit(0);
}

$tmpRoot = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'fhinkai-site-deploy-' . bin2hex(random_bytes(8));

try {
    if (!is_dir(WEB_ROOT)) {
        fail('Web root does not exist: ' . WEB_ROOT);
    }

    if (!class_exists('ZipArchive')) {
        fail('PHP ZipArchive extension is not available.');
    }

    $sha = remoteSha();
    $state = readState();

    if ($sha !== null && ($state['sha'] ?? null) === $sha) {
        logLine("Already deployed {$sha}; nothing to do.");
        exit(0);
    }

    if (!mkdir($tmpRoot, 0755, true)) {
        fail('Unable to create temp directory.');
    }

    $zipPath = $tmpRoot . DIRECTORY_SEPARATOR . 'master.zip';
    logLine('Downloading repository zip.');
    file_put_contents($zipPath, request(REPO_ZIP_URL));

    logLine('Extracting repository zip.');
    $sourceDir = extractZip($zipPath, $tmpRoot . DIRECTORY_SEPARATOR . 'extract');

    if (!is_file($sourceDir . DIRECTORY_SEPARATOR . 'index.html')) {
        throw new RuntimeException('Repository zip does not contain index.html.');
    }

    logLine('Cleaning web root.');
    $deleted = cleanWebRoot(WEB_ROOT);

    logLine('Copying files.');
    $copied = copyTree($sourceDir, WEB_ROOT);

    writeState($sha);
    rrmdir($tmpRoot);

    logLine("Deployment completed. sha=" . ($sha ?? 'unknown') . " copied={$copied} deleted={$deleted}");
} catch (Throwable $e) {
    rrmdir($tmpRoot);
    fail($e->getMessage());
} finally {
    flock($lock, LOCK_UN);
    fclose($lock);
}
