# Deploy to Aliyun ECS with Nginx

This project is a Vite/Vue single page app. Build locally and serve the generated `dist/` files from Nginx.

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
