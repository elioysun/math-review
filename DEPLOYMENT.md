# Deployment

This project is a Vite/Vue single page app. It can be deployed to GitHub Pages or served from an ECS static directory.

## GitHub Pages

The repository includes a GitHub Actions workflow at:

```text
.github/workflows/deploy-pages.yml
```

The workflow builds the app with the GitHub Pages base path:

```sh
pnpm build:pages
```

It also copies `dist/index.html` to `dist/404.html` so direct visits to Vue routes such as `/record`, `/review`, and `/problems` can fall back to the SPA entry.

To enable Pages:

1. Push the repository to GitHub.
2. Open the repository settings.
3. Go to Pages.
4. Set the source to GitHub Actions.
5. Run the `Deploy GitHub Pages` workflow or push to `main`.

The default project URL is:

```text
https://elioysun.github.io/math-review/
```

## Aliyun ECS with Python systemd service

The ECS deployment is intentionally script-driven. Do not start ad-hoc servers such as `python3 -m http.server 80`; port 80 should be owned by the `math-review` systemd service.

The default ECS target is:

```text
admin@47.254.252.144
```

Override it with `ECS_USER` and `ECS_HOST` when needed.

## Deploy to ECS

```sh
pnpm deploy:ecs
```

`deploy/deploy_ecs.sh` performs the full release flow:

1. Builds `dist/` locally.
2. Compiles `deploy/spa_static_server.py` locally.
3. Uploads `dist/`, `spa_static_server.py`, and `math-review.service`.
4. Compiles the server script on ECS before installing it.
5. Backs up the existing service/script.
6. Publishes `dist/` through a staged tar upload and a versioned directory switch.
7. Stops unmanaged `python3 -m http.server 80` processes if present.
8. Reloads systemd, restarts `math-review`, and verifies routes.

The expected route checks are:

```text
/                         200
/problems                 200
/review                   200
/assets/not-found.js      404
```

## Verify ECS Without Deploying

```sh
pnpm verify:ecs
```

`deploy/verify_ecs.sh` checks both server-local and public routes. It also fails if the `math-review` unit points at `python3 -m http.server 80` or if an unmanaged `http.server` process is running.

## Systemd Service

The service starts the SPA-aware server:

```sh
/usr/bin/python3 /www/wwwroot/math-review/spa_static_server.py --directory /www/wwwroot/math-review/dist --host 0.0.0.0 --port 80
```

The unit has startup preflight checks for Python syntax, `dist/index.html`, and `dist/assets`. It uses `Restart=on-failure` so configuration errors do not become silent endless restarts.

## Optional Nginx config

`deploy/nginx.math-review.conf` is kept as an alternative deployment option. It points at `/www/wwwroot/math-review/dist` and uses `try_files $uri $uri/ /index.html;` for Vue history routes.

Do not enable Nginx on port 80 while `math-review.service` is also running on port 80. Switching to Nginx should be treated as a separate production change with `nginx -t`, rollback steps, and route verification.
