import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const repoRoot = process.cwd()

function readProjectFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8')
}

describe('ECS deployment guardrails', () => {
  test('systemd unit starts the SPA static server with startup preflight checks', () => {
    const service = readProjectFile('deploy/math-review.service')

    expect(service).toContain(
      'ExecStart=/usr/bin/python3 /www/wwwroot/math-review/spa_static_server.py --directory /www/wwwroot/math-review/dist --host 0.0.0.0 --port 80',
    )
    expect(service).not.toContain('python3 -m http.server')
    expect(service).toContain(
      'ExecStartPre=/usr/bin/python3 -m py_compile /www/wwwroot/math-review/spa_static_server.py',
    )
    expect(service).toContain(
      'ExecStartPre=/usr/bin/test -f /www/wwwroot/math-review/dist/index.html',
    )
    expect(service).toContain(
      'ExecStartPre=/usr/bin/test -d /www/wwwroot/math-review/dist/assets',
    )
    expect(service).toContain('Restart=on-failure')
  })

  test('deploy script installs one supervised service and verifies SPA routes', () => {
    const scriptPath = join(repoRoot, 'deploy/deploy_ecs.sh')

    expect(existsSync(scriptPath)).toBe(true)

    const script = readProjectFile('deploy/deploy_ecs.sh')

    expect(script).toContain('set -euo pipefail')
    expect(script).toContain('pnpm build')
    expect(script).not.toContain('require_command rsync')
    expect(script).toContain('COPYFILE_DISABLE=1 tar -C dist -czf - .')
    expect(script).toContain('REMOTE_PREVIOUS="${REMOTE_DIST}.previous"')
    expect(script).toContain('/usr/bin/python3 -m py_compile ~/spa_static_server.py')
    expect(script).toContain('sudo systemctl daemon-reload')
    expect(script).toContain('sudo systemctl restart "${SERVICE_NAME}"')
    expect(script).toContain('python3 -m http.server 80')
    expect(script).toContain('expect_status http://127.0.0.1/ 200')
    expect(script).toContain('expect_status http://127.0.0.1/problems 200')
    expect(script).toContain('expect_status http://127.0.0.1/review 200')
    expect(script).toContain('expect_status http://127.0.0.1/assets/not-found.js 404')
  })

  test('read-only verification script checks service ownership and public routes', () => {
    const scriptPath = join(repoRoot, 'deploy/verify_ecs.sh')

    expect(existsSync(scriptPath)).toBe(true)

    const script = readProjectFile('deploy/verify_ecs.sh')

    expect(script).toContain('systemctl is-active --quiet math-review')
    expect(script).toContain('systemctl cat math-review')
    expect(script).toContain('python3 -m http.server 80')
    expect(script).toContain('expect_status http://127.0.0.1/ 200')
    expect(script).toContain('expect_status "http://${ECS_HOST}/" 200')
    expect(script).toContain('expect_status "http://${ECS_HOST}/problems" 200')
    expect(script).toContain('expect_status "http://${ECS_HOST}/review" 200')
    expect(script).toContain('expect_status "http://${ECS_HOST}/assets/not-found.js" 404')
  })

  test('static server and optional Nginx config match ECS runtime assumptions', () => {
    const server = readProjectFile('deploy/spa_static_server.py')
    const nginx = readProjectFile('deploy/nginx.math-review.conf')

    expect(server).toContain('allow_reuse_address = True')
    expect(nginx).toContain('root /www/wwwroot/math-review/dist;')
    expect(nginx).toContain('try_files $uri $uri/ /index.html;')
  })
})
