import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// 启用CORS
app.use(cors());

// 解析JSON请求体
app.use(express.json());

// API端点：保存配置到.env文件
app.post('/api/save-env', (req, res) => {
  try {
    const { envContent } = req.body;
    
    // 确保envContent存在
    if (!envContent) {
      return res.status(400).json({ 
        success: false, 
        message: '缺少envContent参数' 
      });
    }
    
    // 定义.env文件路径
    const envPath = path.join(__dirname, '.env');
    
    // 写入文件
    fs.writeFileSync(envPath, envContent, 'utf8');
    
    // 返回成功响应
    res.json({ 
      success: true, 
      message: '配置已成功保存到.env文件' 
    });
  } catch (error) {
    console.error('保存.env文件时出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '保存配置时出错: ' + error.message 
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`后端服务器运行在 http://localhost:${PORT}`);
});
