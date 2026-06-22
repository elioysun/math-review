# Math Review 网站更新说明

网站地址：

```text
http://47.254.252.144
```

服务器网站目录：

```bash
/www/wwwroot/math-review/dist
```

当前网站运行方式：

```text
systemd 托管自定义 python3 静态服务
服务名：math-review
端口：80
```

服务脚本位置：

```bash
/www/wwwroot/math-review/spa_static_server.py
```

这个脚本会正常返回真实静态文件，并在刷新 `/review`、`/problems` 这类 Vue 前端路由时回退到 `index.html`。缺失的 JS/CSS/图片等资源仍然返回 404。

## 一、更新网站的标准流程

### 1. 在本地重新构建项目

在你自己的电脑项目目录里执行：

```bash
pnpm build
```

构建完成后，会生成新的：

```text
dist/
```

### 2. 上传新的 dist 到服务器

推荐先删除服务器旧文件，再上传新文件。

在本地执行：

```bash
scp -r dist/* admin@47.254.252.144:/www/wwwroot/math-review/dist/
scp deploy/spa_static_server.py admin@47.254.252.144:~/
scp deploy/math-review.service admin@47.254.252.144:~/
```

如果提示权限问题，改用：

```bash
scp -r dist/* admin@47.254.252.144:~/dist-upload/
scp deploy/spa_static_server.py admin@47.254.252.144:~/
scp deploy/math-review.service admin@47.254.252.144:~/
```

然后登录服务器：

```bash
ssh admin@47.254.252.144
```

再执行：

```bash
sudo rm -rf /www/wwwroot/math-review/dist/*
sudo cp -r ~/dist-upload/* /www/wwwroot/math-review/dist/
sudo cp ~/spa_static_server.py /www/wwwroot/math-review/spa_static_server.py
sudo cp ~/math-review.service /etc/systemd/system/math-review.service
sudo systemctl daemon-reload
```

### 3. 重启网站服务

登录服务器后执行：

```bash
sudo systemctl restart math-review
```

### 4. 检查是否更新成功

服务器内执行：

```bash
curl -I http://127.0.0.1
curl -I http://127.0.0.1/review
curl -I http://127.0.0.1/problems
curl -I http://127.0.0.1/assets/not-found.js
curl -I http://47.254.252.144
curl -I http://47.254.252.144/review
curl -I http://47.254.252.144/problems
curl -I http://47.254.252.144/assets/not-found.js
```

如果 `/`、`/review`、`/problems` 看到：

```text
HTTP/1.0 200 OK
```

并且 `/assets/not-found.js` 看到 404，说明网站和刷新回退都正常。

然后浏览器打开：

```text
http://47.254.252.144
```

再打开并刷新：

```text
http://47.254.252.144/review
http://47.254.252.144/problems
```

如果页面没变化，强制刷新：

```text
Mac: Cmd + Shift + R
Windows: Ctrl + F5
```

## 二、常用运维命令

查看网站服务状态：

```bash
sudo systemctl status math-review --no-pager
```

重启网站：

```bash
sudo systemctl restart math-review
```

停止网站：

```bash
sudo systemctl stop math-review
```

启动网站：

```bash
sudo systemctl start math-review
```

查看 80 端口是否被占用：

```bash
sudo ss -lntp | grep ':80'
```

查看网站日志：

```bash
sudo journalctl -u math-review -n 80 --no-pager
```

查看 systemd 实际启动命令：

```bash
sudo systemctl cat math-review
```

## 三、以后不要再手动执行这个

不要再用：

```bash
sudo python3 -m http.server 80
```

因为普通 `http.server` 不支持 Vue history 路由刷新回退，刷新 `/review` 会把它当作真实文件路径并返回 Python 404。

正确做法是：

```bash
sudo systemctl restart math-review
```

## 四、如果网站打不开，按这个顺序排查

### 1. 看服务是否还活着

```bash
sudo systemctl status math-review --no-pager
```

如果不是 active running，执行：

```bash
sudo systemctl restart math-review
```

### 2. 看本机是否能访问

```bash
curl -I http://127.0.0.1
curl -I http://127.0.0.1/review
```

### 3. 看公网是否能访问

```bash
curl -I http://47.254.252.144
curl -I http://47.254.252.144/review
```

### 4. 看 80 端口

```bash
sudo ss -lntp | grep ':80'
```

### 5. 看日志

```bash
sudo journalctl -u math-review -n 80 --no-pager
```

## 五、最简更新版

以后你只需要记住这几步：

本地：

```bash
pnpm build
scp -r dist/* admin@47.254.252.144:/www/wwwroot/math-review/dist/
scp deploy/spa_static_server.py admin@47.254.252.144:~/
scp deploy/math-review.service admin@47.254.252.144:~/
```

服务器：

```bash
sudo cp ~/spa_static_server.py /www/wwwroot/math-review/spa_static_server.py
sudo cp ~/math-review.service /etc/systemd/system/math-review.service
sudo systemctl daemon-reload
sudo systemctl restart math-review
curl -I http://47.254.252.144
curl -I http://47.254.252.144/review
```

返回 200 就说明更新完成。
