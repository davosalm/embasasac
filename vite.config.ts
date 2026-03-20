{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "routes": [
    {
      "src": "/api/.*",
      "dest": "/index.js"
    },
    {
      "src": "/assets/.*",
      "dest": "/public/assets/$1"
    },
    {
      "src": ".*",
      "dest": "/public/index.html"
    }
  ]
}
