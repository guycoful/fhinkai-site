# JetServer cPanel Deployment

GitHub-hosted runners cannot connect to `israel136.jetserver.net:2083`; JetSecure times out the connection before cPanel UAPI answers.

Deployment is therefore pull-based:

1. GitHub stores the static site on branch `master`.
2. cPanel Cron runs `cpanel-deploy.php` on JetServer.
3. The script downloads `master.zip` from GitHub.
4. The script extracts it and mirrors it into `/home/fhinkaic/public_html`.

## One-time setup in cPanel

Upload `cpanel-deploy.php` to:

```text
/home/fhinkaic/public_html/cpanel-deploy.php
```

Create a Cron Job:

```text
*/5 * * * * /usr/local/bin/php /home/fhinkaic/public_html/cpanel-deploy.php >> /home/fhinkaic/fhinkai-deploy.log 2>&1
```

If `/usr/local/bin/php` does not exist on JetServer, use the PHP path shown in cPanel Cron Jobs.

## Preserved files

The deploy script preserves:

- `.htaccess`
- `.well-known`
- `cgi-bin`
- `cpanel-deploy.php`

Everything else in `public_html` is replaced by the GitHub branch contents.

## GitHub Actions

`.github/workflows/deploy.yml` only validates the static site. It does not push files to cPanel, because port `2083` is not reachable from GitHub-hosted runners.
