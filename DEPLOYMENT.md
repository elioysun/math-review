# Deployment

This project is a Vite/Vue single page app. It can be deployed to GitHub Pages or served from an ECS/Nginx static directory.

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

## Aliyun ECS with Nginx

Build locally and serve the generated `dist/` files from Nginx.

## Local build

```sh
pnpm install
pnpm build
```

## Upload to ECS

Replace `USER` and `HOST` with the ECS SSH user and public IP or domain.

```sh
ssh USER@HOST 'sudo mkdir -p /var/www/math-review && sudo chown -R $USER:$USER /var/www/math-review'
rsync -av --delete dist/ USER@HOST:/var/www/math-review/
```

## Nginx config

Copy `deploy/nginx.math-review.conf` to the ECS Nginx sites directory and enable it according to the server layout.

Ubuntu/Debian example:

```sh
scp deploy/nginx.math-review.conf USER@HOST:/tmp/math-review.conf
ssh USER@HOST 'sudo mv /tmp/math-review.conf /etc/nginx/sites-available/math-review.conf && sudo ln -sf /etc/nginx/sites-available/math-review.conf /etc/nginx/sites-enabled/math-review.conf && sudo nginx -t && sudo systemctl reload nginx'
```

CentOS/Alibaba Cloud Linux example:

```sh
scp deploy/nginx.math-review.conf USER@HOST:/tmp/math-review.conf
ssh USER@HOST 'sudo mv /tmp/math-review.conf /etc/nginx/conf.d/math-review.conf && sudo nginx -t && sudo systemctl reload nginx'
```

The Nginx config uses `try_files $uri $uri/ /index.html;` so direct refreshes on Vue routes such as `/review` and `/problems` work correctly.
