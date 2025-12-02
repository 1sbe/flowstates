const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "https://api.seb777.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://api.seb777.com",
        "wss://api.seb777.com"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (req.headers.origin && req.headers.origin.includes('seb777.com')) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }
  next();
});

// API proxy example (optional)
app.use('/api/proxy', (req, res) => {
  res.redirect(307, `https://api.seb777.com${req.path}`);
});

// Serve static files from Angular build
// FIRST: Check what your actual dist folder structure is:
console.log('Checking dist folder structure...');
const fs = require('fs');
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  const items = fs.readdirSync(distPath);
  console.log('Dist folder contents:', items);
  
  // Try to find the correct folder
  let angularFolder = null;
  items.forEach(item => {
    const itemPath = path.join(distPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      console.log(`Found directory: ${item}`);
      const browserPath = path.join(itemPath, 'browser');
      if (fs.existsSync(browserPath)) {
        angularFolder = browserPath;
        console.log(`Found Angular browser folder: ${browserPath}`);
      }
    }
  });
  
  if (angularFolder) {
    app.use(express.static(angularFolder, {
      etag: true,
      lastModified: true,
      maxAge: '1y',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        } else if (filePath.match(/\.(js|css|woff2?|eot|ttf|otf)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
  } else {
    // Fallback to assuming dist/[app-name] structure
    const appName = items[0]; // Take first directory
    angularFolder = path.join(distPath, appName, 'browser');
    console.log(`Assuming Angular folder: ${angularFolder}`);
    
    if (fs.existsSync(angularFolder)) {
      app.use(express.static(angularFolder, {
        etag: true,
        lastModified: true,
        maxAge: '1y',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
          } else if (filePath.match(/\.(js|css|woff2?|eot|ttf|otf)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        }
      }));
    }
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'showcase.seb777.com',
    api: 'https://api.seb777.com',
    timestamp: new Date().toISOString()
  });
});

// FIXED: Handle all Angular routes - MUST BE LAST
// Use a regex pattern instead of '*'
app.get(/^[^.]+$/, (req, res) => {
  // This regex matches any route that doesn't contain a dot (.) 
  // to avoid matching files like main.js, styles.css, etc.
  
  // Find the Angular index.html file
  const distPath = path.join(__dirname, 'dist');
  let indexPath = null;
  
  if (fs.existsSync(distPath)) {
    const items = fs.readdirSync(distPath);
    items.forEach(item => {
      const itemPath = path.join(distPath, item);
      if (fs.statSync(itemPath).isDirectory()) {
        const browserPath = path.join(itemPath, 'browser');
        if (fs.existsSync(browserPath)) {
          const potentialIndex = path.join(browserPath, 'index.html');
          if (fs.existsSync(potentialIndex)) {
            indexPath = potentialIndex;
          }
        }
      }
    });
  }
  
  if (indexPath && fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback
    res.sendFile(path.join(__dirname, 'dist/showcase/browser/index.html'));
  }
});

// Alternative simpler fix: use the specific path pattern
// app.get('/*', (req, res) => {  // This also works
//   const indexPath = path.join(__dirname, 'dist/showcase/browser/index.html');
//   res.sendFile(indexPath);
// });

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Showcase server running on http://localhost:${PORT}`);
  console.log(`API endpoint: https://api.seb777.com`);
  console.log(`Test URL: http://localhost:${PORT}/health`);
});