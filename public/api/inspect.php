<?php

declare(strict_types=1);

const SEOMARKUP_MAX_BODY_BYTES = 2_000_000;
const SEOMARKUP_MAX_REDIRECTS = 4;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function publicIp(string $ip): bool
{
    return filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) !== false;
}

function normalizedTarget(string $value): array
{
    $value = trim($value);
    if ($value === '' || strlen($value) > 2048) {
        throw new InvalidArgumentException('Enter one public URL under 2,048 characters.');
    }

    if (!preg_match('~^https?://~i', $value)) {
        $value = 'https://' . $value;
    }

    $parts = parse_url($value);
    if (!is_array($parts) || empty($parts['host']) || empty($parts['scheme'])) {
        throw new InvalidArgumentException('Enter a full public URL, such as https://example.com.');
    }

    $scheme = strtolower((string) $parts['scheme']);
    if (!in_array($scheme, ['http', 'https'], true)) {
        throw new InvalidArgumentException('Enter a public HTTP or HTTPS page.');
    }
    if (isset($parts['user']) || isset($parts['pass'])) {
        throw new InvalidArgumentException('Remove login details from the URL and try again.');
    }
    if (isset($parts['port']) && !in_array((int) $parts['port'], [80, 443], true)) {
        throw new InvalidArgumentException('Use a URL on standard web port 80 or 443.');
    }

    $host = rtrim(strtolower((string) $parts['host']), '.');
    if ($host === 'localhost' || str_ends_with($host, '.localhost')) {
        throw new InvalidArgumentException('Enter a public URL. Private and local network addresses are blocked.');
    }

    if (function_exists('idn_to_ascii')) {
        $asciiHost = idn_to_ascii($host, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
        if (is_string($asciiHost) && $asciiHost !== '') {
            $host = strtolower($asciiHost);
        }
    }

    $records = dns_get_record($host, DNS_A | DNS_AAAA);
    $ips = [];
    foreach ($records ?: [] as $record) {
        $ip = $record['ip'] ?? $record['ipv6'] ?? null;
        if (is_string($ip)) {
            $ips[] = $ip;
        }
    }
    $ips = array_values(array_unique($ips));

    if (filter_var($host, FILTER_VALIDATE_IP)) {
        $ips = [$host];
    }
    if ($ips === [] || array_filter($ips, static fn (string $ip): bool => !publicIp($ip))) {
        throw new InvalidArgumentException('This URL resolves to a private or reserved address. Enter a public URL.');
    }

    $port = isset($parts['port']) ? (int) $parts['port'] : ($scheme === 'https' ? 443 : 80);
    $path = $parts['path'] ?? '/';
    $query = isset($parts['query']) ? '?' . $parts['query'] : '';
    $displayHost = str_contains($host, ':') ? '[' . $host . ']' : $host;
    $portPart = isset($parts['port']) ? ':' . $port : '';

    return [
        'url' => $scheme . '://' . $displayHost . $portPart . ($path === '' ? '/' : $path) . $query,
        'host' => $host,
        'port' => $port,
        'ip' => $ips[0],
    ];
}

function resolveRedirect(string $location, string $base): string
{
    if (preg_match('~^https?://~i', $location)) {
        return $location;
    }

    $baseParts = parse_url($base);
    if (!is_array($baseParts) || empty($baseParts['scheme']) || empty($baseParts['host'])) {
        throw new RuntimeException('The page redirects to an invalid URL. Try its final public URL instead.');
    }

    $origin = $baseParts['scheme'] . '://' . $baseParts['host'] . (isset($baseParts['port']) ? ':' . $baseParts['port'] : '');
    if (str_starts_with($location, '//')) {
        return $baseParts['scheme'] . ':' . $location;
    }
    if (str_starts_with($location, '/')) {
        return $origin . $location;
    }

    $directory = preg_replace('~/[^/]*$~', '/', $baseParts['path'] ?? '/');
    return $origin . $directory . $location;
}

function fetchPage(string $submittedUrl): array
{
    $target = $submittedUrl;

    for ($redirect = 0; $redirect <= SEOMARKUP_MAX_REDIRECTS; $redirect++) {
        $validated = normalizedTarget($target);
        $body = '';
        $headers = [];
        $tooLarge = false;
        $curl = curl_init($validated['url']);

        $pinnedIp = str_contains($validated['ip'], ':') ? '[' . $validated['ip'] . ']' : $validated['ip'];
        curl_setopt_array($curl, [
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_RETURNTRANSFER => false,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 12,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_USERAGENT => 'SEOMarkup-Web-Inspector/0.2 (+https://schema.businesspress.io/)',
            CURLOPT_HTTPHEADER => [
                'Accept: text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
                'Accept-Language: en,*;q=0.5',
            ],
            CURLOPT_RESOLVE => [sprintf('%s:%d:%s', $validated['host'], $validated['port'], $pinnedIp)],
            CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$headers): int {
                $length = strlen($line);
                $position = strpos($line, ':');
                if ($position !== false) {
                    $name = strtolower(trim(substr($line, 0, $position)));
                    $headers[$name] = trim(substr($line, $position + 1));
                }
                return $length;
            },
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body, &$tooLarge): int {
                if (strlen($body) + strlen($chunk) > SEOMARKUP_MAX_BODY_BYTES) {
                    $tooLarge = true;
                    return 0;
                }
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);

        $success = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if ($tooLarge) {
            throw new RuntimeException('This page is larger than the 2 MB limit. Try a smaller page.');
        }
        if ($success === false) {
            throw new RuntimeException($error !== '' ? 'We could not fetch this page within the safety limits. Try again or use the extension.' : 'We could not fetch this page. Try again or use the extension.');
        }

        if ($status >= 300 && $status < 400 && isset($headers['location'])) {
            if ($redirect === SEOMARKUP_MAX_REDIRECTS) {
                throw new RuntimeException('This page redirects too many times. Enter its final URL instead.');
            }
            $target = resolveRedirect($headers['location'], $validated['url']);
            continue;
        }

        if ($status < 200 || $status >= 400) {
            throw new RuntimeException('This page returned HTTP ' . $status . '. Check the URL or try another public page.');
        }

        $contentType = strtolower($headers['content-type'] ?? '');
        if ($contentType !== '' && !str_contains($contentType, 'text/html') && !str_contains($contentType, 'application/xhtml+xml')) {
            throw new RuntimeException('This URL does not return an HTML page. Enter a webpage URL.');
        }

        return [
            'url' => $validated['url'],
            'status' => $status,
            'contentType' => $headers['content-type'] ?? 'text/html',
            'bytes' => strlen($body),
            'html' => $body,
        ];
    }

    throw new RuntimeException('We could not check this page. Try again or use the extension.');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'error' => 'Use the URL form to check a page.']);
}

$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
if ($contentLength > 4096) {
    respond(413, ['ok' => false, 'error' => 'This request is too large. Enter one public URL.']);
}

$input = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['url']) || !is_string($input['url'])) {
    respond(422, ['ok' => false, 'error' => 'Enter one public URL.']);
}

try {
    $page = fetchPage($input['url']);
    respond(200, ['ok' => true, 'page' => $page]);
} catch (InvalidArgumentException $error) {
    respond(422, ['ok' => false, 'error' => $error->getMessage()]);
} catch (Throwable $error) {
    respond(502, ['ok' => false, 'error' => $error->getMessage()]);
}
