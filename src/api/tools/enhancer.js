/**
 * CR Ponta Sensei
 * CH https://whatsapp.com/channel/0029VagslooA89MdSX0d1X1z
 * WEB https://codeteam.my.id
**/

import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function PhotoEnhancer(imagePath) {
  try {
    const form = new FormData();
    form.append("image", fs.createReadStream(imagePath));
    form.append("enable_quality_check", "true");
    form.append("output_format", "jpg");

    const res = await axios.post(
      "https://photoenhancer.pro/api/fast-enhancer",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "origin": "https://photoenhancer.pro",
          "referer": "https://photoenhancer.pro/upload?tool=enhance&mode=fast",
          "user-agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    if (!res.data || !res.data.success) throw new Error("Gagal enhance gambar");

    return {
      success: true,
      url: `https://photoenhancer.pro${res.data.url}`,
      originalName: imagePath.split("/").pop(),
    };
  } catch (e) {
    return {
      success: false,
      error: e.message,
    };
  }
}

export default function (app) {
  app.post('/tools/enhancer', async (req, res) => {
    try {
      // Check if file was uploaded
      if (!req.files || !req.files.image) {
        return res.status(400).json({
          status: false,
          error: 'No image uploaded',
          message: 'Please upload an image file using the "image" field'
        });
      }

      const imageFile = req.files.image;
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(imageFile.mimetype)) {
        return res.status(400).json({
          status: false,
          error: 'Invalid file type',
          message: 'Only JPEG, PNG, and WebP images are supported'
        });
      }

      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024;
      if (imageFile.size > maxSize) {
        return res.status(400).json({
          status: false,
          error: 'File too large',
          message: 'Image must be less than 5MB'
        });
      }

      // Save uploaded file temporarily
      const tempDir = path.join(__dirname, '../../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `${Date.now()}_${imageFile.name}`);
      await imageFile.mv(tempFilePath);

      // Process the image
      const result = await PhotoEnhancer(tempFilePath);

      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Could not delete temporary file:', cleanupError.message);
      }

      if (result.success) {
        res.json({
          status: true,
          creator: "VeronDev",
          result: {
            enhancedUrl: result.url,
            originalName: result.originalName
          },
          message: "Image enhanced successfully"
        });
      } else {
        res.status(500).json({
          status: false,
          error: 'Enhancement failed',
          message: result.error || 'Failed to enhance image'
        });
      }

    } catch (error) {
      console.error('Photo enhancer error:', error);
      res.status(500).json({
        status: false,
        error: 'Internal server error',
        message: 'An error occurred while processing the image'
      });
    }
  });

  // URL-based enhancement endpoint
  app.get('/tools/enhancer', async (req, res) => {
    try {
      const { imageUrl } = req.query;

      if (!imageUrl) {
        return res.status(400).json({
          status: false,
          error: 'Missing required parameter',
          message: 'imageUrl parameter is required'
        });
      }

      // Validate URL format
      try {
        new URL(imageUrl);
      } catch (error) {
        return res.status(400).json({
          status: false,
          error: 'Invalid URL',
          message: 'Please provide a valid image URL'
        });
      }

      // Download image from URL
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream'
      });

      // Check content type
      const contentType = response.headers['content-type'];
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!contentType || !allowedTypes.some(type => contentType.includes(type))) {
        return res.status(400).json({
          status: false,
          error: 'Invalid image type',
          message: 'URL must point to a JPEG, PNG, or WebP image'
        });
      }

      // Save downloaded image temporarily
      const tempDir = path.join(__dirname, '../../../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `${Date.now()}_downloaded_image`);
      const writer = fs.createWriteStream(tempFilePath);
      
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // Process the image
      const result = await PhotoEnhancer(tempFilePath);

      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Could not delete temporary file:', cleanupError.message);
      }

      if (result.success) {
        res.json({
          status: true,
          creator: "VeronDev",
          result: {
            enhancedUrl: result.url,
            originalName: result.originalName
          },
          message: "Image enhanced successfully"
        });
      } else {
        res.status(500).json({
          status: false,
          error: 'Enhancement failed',
          message: result.error || 'Failed to enhance image'
        });
      }

    } catch (error) {
      console.error('Photo enhancer error:', error);
      if (error.response && error.response.status === 404) {
        return res.status(400).json({
          status: false,
          error: 'Image not found',
          message: 'Could not download image from the provided URL'
        });
      }
      res.status(500).json({
        status: false,
        error: 'Internal server error',
        message: 'An error occurred while processing the image'
      });
    }
  });
}