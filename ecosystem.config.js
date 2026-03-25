module.exports = {
  apps: [
    {
      name: 'system-design',
      script: 'npm',
      args: 'start -- -p 3001',
      cwd: '/home/ubuntu/home/project/system-design-course/docs-site',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
    },
  ],
}
