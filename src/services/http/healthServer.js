const http = require('node:http');

function createHealthServer(options) {
  const { config, logger, speechService } = options;
  let server = null;

  return {
    async start() {
      if (!config.enabled) {
        return;
      }

      if (server) {
        return;
      }

      server = http.createServer((request, response) => {
        if (request.url !== '/' && request.url !== '/health') {
          response.writeHead(404, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ ok: false }));
          return;
        }

        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({
          ok: true,
          speech: speechService.getAvailability(),
          uptimeSeconds: Math.floor(process.uptime())
        }));
      });

      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.port, config.host, resolve);
      });

      logger.info('Health-Server ist gestartet.', {
        host: config.host,
        port: config.port
      });
    },
    async stop() {
      if (!server) {
        return;
      }

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      server = null;
    }
  };
}

module.exports = {
  createHealthServer
};
