const express = require('express');
const multer = require('multer');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const upload = multer({ dest: '/tmp/uploads/' });

app.use(express.json());

const WORK_DIR = '/tmp/deploys';
const OUTPUT_DIR = '/var/www/html';

if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/deploy/python', upload.single('code'), async (req, res) => {
    const deployId = uuidv4().slice(0, 12);
    const workPath = path.join(WORK_DIR, deployId);
    const outputPath = path.join(OUTPUT_DIR, deployId);
    
    try {
        fs.mkdirSync(workPath);
        fs.mkdirSync(outputPath);

        let code = req.body.code;
        let filename = req.body.filename || 'main.py';
        
        if (req.file) {
            code = fs.readFileSync(req.file.path, 'utf8');
            filename = req.file.originalname || 'main.py';
        }
        
        if (!code) {
            return res.status(400).json({ error: 'No code provided' });
        }
        
        fs.writeFileSync(path.join(workPath, filename), code);
        
        process.chdir(workPath);
        
        console.log(`Building Python game: ${deployId}`);
        
        try {
            execSync('pip install pygbag --quiet 2>&1', { 
                stdio: 'pipe',
                timeout: 120 
            });
        } catch (e) {
            console.log('pip install:', e.message);
        }
        
        try {
            execSync(`pip3 install --break-system-packages pygame pygbag 2>&1`, { 
                stdio: 'pipe',
                timeout: 120 
            });
        } catch (e) {
            console.log('pip install:', e.message);
        }
        
        try {
            execSync(`python3 -m pygbag --package Bernadette ${filename} 2>&1`, { 
                stdio: 'inherit',
                cwd: workPath,
                timeout: 180
            });
        } catch (e) {
            console.log('pygbag build:', e.message);
        }
        
        // pygbag creates Bernadette/build/web/ (not release)
        const BernadetteDir = path.join(workPath, 'Bernadette', 'build', 'web');
        
        let built = false;
        if (fs.existsSync(BernadetteDir)) {
            const files = fs.readdirSync(BernadetteDir);
            if (files.length > 0) {
                fs.cpSync(BernadetteDir, outputPath, { recursive: true });
                built = true;
                console.log(`Copied to ${outputPath}`);
            }
        }
        
        if (!built) {
            return res.status(500).json({ error: 'Build failed - no output generated. Make sure your file is named main.py and uses pygame.' });
        }
        
        const deployUrl = `https://game-deploy-service.onrender.com/games/${deployId}/index.html`;
        
        console.log(`Build successful: ${deployId} -> ${deployUrl}`);
        
        res.json({
            success: true,
            deploy_id: deployId,
            deploy_url: deployUrl,
            message: 'Deploy complete!'
        });
        
    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/deploy/java', upload.single('code'), async (req, res) => {
    const deployId = uuidv4().slice(0, 12);
    const workPath = path.join(WORK_DIR, deployId);
    const outputPath = path.join(OUTPUT_DIR, deployId);
    
    try {
        fs.mkdirSync(workPath);
        fs.mkdirSync(outputPath);

        let code = req.body.code;
        let filename = req.body.filename || 'Main.java';
        
        if (req.file) {
            code = fs.readFileSync(req.file.path, 'utf8');
            filename = req.file.originalname || 'Main.java';
        }
        
        if (!code) {
            return res.status(400).json({ error: 'No code provided' });
        }
        
        fs.writeFileSync(path.join(workPath, filename), code);
        
        process.chdir(workPath);
        
        console.log(`Compiling Java: ${deployId}`);
        
        try {
            execSync(`javac ${filename} 2>&1`, { 
                stdio: 'inherit',
                timeout: 60 
            });
        } catch (e) {
            return res.status(400).json({ error: 'Compilation failed: ' + e.message });
        }
        
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Java Game</title>
    <style>
        body { margin: 0; background: #111; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: system-ui; color: #fff; }
        canvas { border: 2px solid #444; }
        .info { margin-top: 1rem; color: #888; text-align: center; }
    </style>
</head>
<body>
    <h2>Java Game</h2>
    <p class="info">Note: Java browser applets are deprecated.<br>For browser games, consider converting to JavaScript (p5.js, Phaser).</p>
</body>
</html>`;
        
        fs.writeFileSync(path.join(outputPath, 'index.html'), htmlContent);
        
        const deployUrl = `https://game-deploy-service.onrender.com/games/${deployId}/index.html`;
        
        console.log(`Java build successful: ${deployId}`);
        
        res.json({
            success: true,
            deploy_id: deployId,
            deploy_url: deployUrl,
            message: 'Java compiled. Note: Java browser applets are deprecated.'
        });
        
    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Deploy service running on port ${PORT}`);
    console.log(`Games will be served at https://game-deploy-service.onrender.com/games/{id}/`);
});
