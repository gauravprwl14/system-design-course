# CLAUDE.local.md — Local Environment & Deployment Notes

## Server & Proxy Setup

### Production URL
- **Public URL**: `https://rnd.blr0.geekydev.com/system-design/`
- **Internal port**: `3001` (Next.js server)
- **Reverse proxy**: Nginx

### Nginx Proxy Pass
The site runs behind Nginx which proxies `/system-design/` to the Next.js server on port 3001.

The nginx config is split across:
- **Domain config**: `/etc/nginx/sites-available/rnd.blr0.geekydev.com`
- **App config**: `/etc/nginx/apps.d/rnd-system-design.conf`
- **Snippets**: `/etc/nginx/snippets/proxy-params.conf`, `/etc/nginx/snippets/security-basic-auth.conf`

```nginx
# /etc/nginx/apps.d/rnd-system-design.conf
location /system-design {
    include /etc/nginx/snippets/security-basic-auth.conf;
    include /etc/nginx/snippets/proxy-params.conf;
    proxy_pass http://localhost:3001/system-design;
}

# /etc/nginx/snippets/proxy-params.conf
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

> **Basic Auth**: The site is protected by HTTP Basic Auth (`/etc/nginx/.htpasswd`).

> **Important**: The Next.js app uses `basePath: '/system-design'` in `next.config.mjs`.
> All internal links and asset URLs are prefixed with `/system-design/`.
> The nginx location block MUST match the basePath prefix.

### PM2 Process Manager
The Next.js server is managed by PM2:

```bash
# Start (uses ecosystem.config.js at repo root)
pm2 start /home/ubuntu/home/project/system-design-course/ecosystem.config.js

# Restart after a new build
pm2 restart system-design

# Check logs
pm2 logs system-design --lines 30

# Check status
pm2 list
```

### Ecosystem Config
Located at `/home/ubuntu/home/project/system-design-course/ecosystem.config.js`:
- Script: `npm start -- -p 3001`
- CWD: `docs-site/`
- PORT env: `3001`
- NODE_ENV: `production`

### Deploy After Build
After every `npm run build`, restart PM2:
```bash
cd docs-site && npm run build
pm2 restart system-design
```

No static file copying needed (standalone mode is disabled).

## Next.js Config Notes

- `basePath: '/system-design'` — all pages served under this prefix
- `output: 'standalone'` is **disabled** — `next start` works directly
- `postbuild` runs `pagefind --site .next/server/app` for search indexing

## Content Location

All content is in `docs-site/content/` (Nextra 4 App Router layout):
- Root nav structure defined in `docs-site/content/_meta.js`
- Each section has its own `_meta.js` for sidebar ordering
- Pages at `content/NN-section/subsection/page.md`

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 502 Bad Gateway | PM2 not running or wrong port | `pm2 restart system-design` |
| Sidebar empty | Missing `content/_meta.js` | Create root meta file |
| Banner link 404 | Absolute href missing basePath | Use `/system-design/path` not `/path` |
| 404 on all pages | Nginx not matching `/system-design/` | Check nginx location block |
