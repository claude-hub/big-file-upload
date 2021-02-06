const proxy = require('http-proxy-middleware');

module.exports = (app) => {
  app.use(
    '/api',
    proxy.createProxyMiddleware({
      target: 'http://127.0.0.1:7001',
      changeOrigin: true,
      pathRewrite: {
        '^/api': ''
      }
    })
  );
};