const express = require('express');
const multer = require('multer');
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const upload = multer({ dest: '/tmp/uploads/' });

app.use(express.json());

// Ensure directories exist
const WORK_DIR = '/tmp/deploys';
const OUTPUT_DIR = '/tmp/output';
if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/deploy/python', upload.single('code'), async (req, res) => {
    const deployId = uuidv4().slice(0, 8);
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
            execSync('pip install pygbag --quiet 2>/dev/null || pip install pygbag', { 
                stdio: 'pipe',
                timeout: 120 
            });
        } catch (e) {
            console.log('pygbag already installed or install failed:', e.message);
        }
        
        try {
            execSync(`python -m pygbag --only Bernadette 2>&1 || python -c "import pygbag; pygbag.main()"`, { 
                stdio: 'inherit',
                cwd: workPath,
                timeout: 180
            });
        } catch (e) {
            console.log('pygbag build output:', e.message);
        }
        
        const BernadetteDir = path.join(workPath, 'Bernadette', 'build', 'release', 'web');
        const BernadetteBuild = path.join(workPath, 'build', 'release', 'web');
        
        let webFiles = null;
        if (fs.existsSync(BernadetteDir)) {
            webFiles = fs.readdirSync(BernadetteDir);
            fs.cpSync(BernadetteDir, outputPath, { recursive: true });
        } else if (fs.existsSync(BernadetteBuild)) {
            webFiles = fs.readdirSync(BernadetteBuild);
            fs.cpSync(BernadetteBuild, outputPath, { recursive: true });
        }
        
        if (!webFiles) {
            return res.status(500).json({ error: 'Build failed - no output generated' });
        }
        
        console.log(`Build successful: ${deployId}`);
        
        res.json({
            success: true,
            deploy_id: deployId,
            message: 'Deploy complete. Files available for download.',
            files: fs.readdirSync(outputPath)
        });
        
    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        setTimeout(() => {
            try {
                if (fs.existsSync(workPath)) fs.rmSync(workPath, { recursive: true });
                if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { recursive: true });
            } catch (e) {}
        }, 300000);
    }
});

app.post('/deploy/java', upload.single('code'), async (req, res) => {
    const deployId = uuidv4().slice(0, 8);
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
        
        const classFiles = execSync(`find . -name "*.class" | head -20`, { encoding: 'utf8' }).trim();
        
        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Java Game</title>
    <style>
        body { margin: 0; background: #000; display: flex; justify-content: center; align-items: center; height: 100vh; }
        canvas { border: 2px solid #333; }
    </style>
</head>
<body>
    <applet code="${filename.replace('.java', '')}.class" archive="" width="800" height="600">
        <param name="code" value="${filename.replace('.java', '')}.class">
    </applet>
    <p>Java applets require a browser that supports Java plugins.</p>
</body>
</html>`;
        
        fs.writeFileSync(path.join(outputPath, 'index.html'), htmlContent);
        
        const zip = require('child_process').execSync('cd /tmp/output/' + deployId + ' && zip -r ../' + deployId + '.zip . 2>&1', { encoding: 'utf8' });
        
        console.log(`Java build successful: ${deployId}`);
        
        res.json({
            success: true,
            deploy_id: deployId,
            message: 'Java compiled successfully. Note: Java browser plugins are deprecated. Consider converting to JavaScript.',
            class_files: classFiles.split('\n'),
            download_url: `/download/${deployId}.zip`
        });
        
    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({ error: error.message });
    } finally {
        setTimeout(() => {
            try {
                if (fs.existsSync(workPath)) fs.rmSync(workPath, { recursive: true });
                if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { recursive: true });
            } catch (e) {}
        }, 300000);
    }
});

app.get('/download/:file', (req, res) => {
    const filePath = path.join('/tmp/output', req.params.file);
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Deploy service running on port ${PORT}`);
});
