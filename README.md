# Game Deploy Service

A simple service to deploy Python (pygame) and Java games.

## Deploy to Render (Free Tier)

1. Go to [render.com](https://render.com) and connect your GitHub repo
2. Create a new **Web Service**
3. Select your repository
4. Settings:
   - **Runtime**: Docker
   - **Region**: Oregon (or closest to you)
   - **Plan**: Free
5. Click **Create Web Service**

## API Endpoints

### Health Check
```
GET /health
```

### Deploy Python (pygame)
```
POST /deploy/python
Content-Type: application/json

{
  "code": "import pygame\n...",
  "filename": "game.py"  // optional, defaults to main.py
}
```

### Deploy Java
```
POST /deploy/java
Content-Type: application/json

{
  "code": "public class Main { ... }",
  "filename": "Main.java"  // optional
}
```

## Response Format

```json
{
  "success": true,
  "deploy_id": "abc12345",
  "message": "Deploy complete"
}
```

## Local Development

```bash
npm install
node server.js
```

## Note

Java browser applets are deprecated. For Java games, consider converting to JavaScript (e.g., using p5.js or Phaser).
