# Math Review 网站更新说明

网站地址：

```text
http://47.254.252.144
```

服务器临时上传目录：

```bash
/tmp/math-review-dist/
```

服务器网站目录：

```bash
/www/wwwroot/math-review/dist/
```

## 一、标准更新方式

以后优先只执行这一条：

```bash
cd /Users/eliosun/Documents/Math_Review
git pull origin main
pnpm deploy:ecs
```

这个脚本会自动完成：

- 本地 `pnpm build`
- 检查 `deploy/spa_static_server.py` 语法
- 上传 `dist/`、`spa_static_server.py`、`math-review.service`
- 在服务器上备份旧 service / 脚本
- 用临时目录和目录切换发布新 `dist/`，并保留上一版 `dist.previous`
- 停掉残留的 `python3 -m http.server 80`
- `systemctl daemon-reload`
- `systemctl restart math-review`
- 验证 `/`、`/problems`、`/review` 返回 200，缺失 asset 返回 404

## 二、只检查网站是否正常

```bash
cd /Users/eliosun/Documents/Math_Review
pnpm verify:ecs
```

它会检查服务器内网和公网：

```text
/                         200
/problems                 200
/review                   200
/assets/not-found.js      404
```

还会检查 `math-review.service` 没有退回到普通 `python3 -m http.server 80`。

## 三、不要再手工启动普通 http.server

```bash
python3 -m http.server 80
```

普通 Python 静态服务不支持 Vue 前端路由。它只能打开 `/`，但直接访问 `/problems`、`/review` 会把它们当成真实文件路径，结果返回 404。

端口 80 应该只由 systemd 管控的 `math-review` 服务占用。

## 四、服务器上必要的排查命令

```bash
sudo systemctl status math-review --no-pager
sudo systemctl cat math-review
sudo ss -ltnp 'sport = :80'
sudo journalctl -u math-review -n 80 --no-pager
```

## 五、手动恢复时的最低要求

如果必须手动恢复，也不要直接删网站目录后再慢慢复制。最低要求是：

```bash
cd /Users/eliosun/Documents/Math_Review
pnpm build
python3 -m py_compile deploy/spa_static_server.py
scp deploy/spa_static_server.py deploy/math-review.service admin@47.254.252.144:~/
COPYFILE_DISABLE=1 tar -C dist -czf - . | ssh admin@47.254.252.144 "rm -rf /tmp/math-review-dist && mkdir -p /tmp/math-review-dist && tar -xzf - -C /tmp/math-review-dist"
ssh admin@47.254.252.144
```

服务器里：

```bash
test -f /tmp/math-review-dist/index.html
test -d /tmp/math-review-dist/assets
/usr/bin/python3 -m py_compile ~/spa_static_server.py
sudo cp ~/spa_static_server.py /www/wwwroot/math-review/spa_static_server.py
sudo cp ~/math-review.service /etc/systemd/system/math-review.service
sudo rm -rf /www/wwwroot/math-review/dist.next /www/wwwroot/math-review/dist.previous
sudo mkdir -p /www/wwwroot/math-review/dist.next
tar -C /tmp/math-review-dist -czf - . | sudo tar -xzf - -C /www/wwwroot/math-review/dist.next
sudo chown -R www:www /www/wwwroot/math-review/dist.next
sudo mv /www/wwwroot/math-review/dist /www/wwwroot/math-review/dist.previous
sudo mv /www/wwwroot/math-review/dist.next /www/wwwroot/math-review/dist
sudo systemctl daemon-reload
sudo pkill -f "python3 -m http.server 80" || true
sudo systemctl enable math-review
sudo systemctl restart math-review
curl -I --max-time 5 http://127.0.0.1
curl -I --max-time 5 http://127.0.0.1/problems
curl -I --max-time 5 http://127.0.0.1/review
```

如果 `/`、`/problems`、`/review` 都返回 `200 OK`，说明路由回退已经修好。

## 六、一句话记忆

```text
平时：pnpm deploy:ecs
检查：pnpm verify:ecs
不要：python3 -m http.server 80
```
