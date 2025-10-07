// Simple logging middleware
function requestLogger(req, res, next) {
  const method = req.method;
  const url = req.originalUrl || req.url;
  
  console.log(`${method} ${url}`);
  
  res.on('finish', () => {
    const status = res.statusCode;
    console.log(`${method} ${url} -> ${status}`);
  });
  
  next();
}

function errorLogger(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  console.error(`ERROR ${status}: ${message}`);
  console.error(err.stack);
  
  if (res.headersSent) return;
  res.status(status).json({ error: message });
}

module.exports = { requestLogger, errorLogger };
