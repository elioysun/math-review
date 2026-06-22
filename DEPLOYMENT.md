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

Build locally and serve the generated `dist/` files with the SPA-aware Python static server in `deploy/spa_static_server.py`.

## Local build

```sh
pnpm install
pnpm build
```

## Upload to ECS

Replace `USER` and `HOST` with the ECS SSH user and public IP or domain.

```sh
ssh USER@HOST 'sudo mkdir -p /www/wwwroot/math-review/dist && sudo chown -R $USER:$USER /www/wwwroot/math-review'
rsync -av --delete dist/ USER@HOST:/www/wwwroot/math-review/dist/
scp deploy/spa_static_server.py deploy/math-review.service USER@HOST:~/
```

## Python systemd service

Install the server script outside `dist/` so normal `dist/` replacement does not delete it.

```sh
ssh USER@HOST 'sudo cp ~/spa_static_server.py /www/wwwroot/math-review/spa_static_server.py && sudo cp ~/math-review.service /etc/systemd/system/math-review.service && sudo systemctl daemon-reload && sudo systemctl enable math-review && sudo systemctl restart math-review'
```

The service runs:

```sh
python3 /www/wwwroot/math-review/spa_static_server.py --directory /www/wwwroot/math-review/dist --host 0.0.0.0 --port 80
```

The server preserves normal static-file behavior, but falls back to `index.html` for Vue history routes such as `/review` and `/problems`.

## Verify deployment

```sh
curl -I http://HOST/
curl -I http://HOST/review
curl -I http://HOST/problems
curl -I http://HOST/assets/not-found.js
```

The first three requests should return `200`. The missing asset check should return `404`, which confirms broken JS/CSS/image paths are not being masked by the SPA fallback.

## Optional Nginx config

`deploy/nginx.math-review.conf` is kept as an alternative deployment option. Its `try_files $uri $uri/ /index.html;` rule provides the same SPA refresh fallback when Nginx is used.
