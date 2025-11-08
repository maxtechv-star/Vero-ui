import axios from 'axios';
import crypto from 'crypto';

class AuthGenerator {
  static #PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDa2oPxMZe71V4dw2r8rHWt59gH
W5INRmlhepe6GUanrHykqKdlIB4kcJiu8dHC/FJeppOXVoKz82pvwZCmSUrF/1yr
rnmUDjqUefDu8myjhcbio6CnG5TtQfwN2pz3g6yHkLgp8cFfyPSWwyOCMMMsTU9s
snOjvdDb4wiZI8x3UwIDAQAB
-----END PUBLIC KEY-----`;
  static #S = 'NHGNy5YFz7HeFb'
  
  constructor(appId) {
    this.appId = appId;
  }

  aesEncrypt(data, key, iv) {
    const keyBuffer = Buffer.from(key, 'utf8');
    const ivBuffer = Buffer.from(iv, 'utf8');
    const cipher = crypto.createCipheriv('aes-128-cbc', keyBuffer, ivBuffer);

    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomBytes[i] % chars.length);
    }
    return result;
  }

  generate() {
    const t = Math.floor(Date.now() / 1000).toString()
    const nonce = crypto.randomUUID();
    const tempAesKey = this.generateRandomString(16);

    const encryptedData = crypto.publicEncrypt({
      key: AuthGenerator.#PUBLIC_KEY,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    }, Buffer.from(tempAesKey));
    const secret_key = encryptedData.toString('base64');

    const dataToSign = `${this.appId}:${AuthGenerator.#S}:${t}:${nonce}:${secret_key}`;
    const sign = this.aesEncrypt(dataToSign, tempAesKey, tempAesKey);
    
    return {
      app_id: this.appId,
      t: t,
      nonce: nonce,
      sign: sign,
      secret_key: secret_key,
    };
  }
}

async function convert(buffer, prompt) {
  try {
    const auth = new AuthGenerator('ai_df');
    const authData = auth.generate();
    const userId = auth.generateRandomString(64).toLowerCase();
    
    const headers = {
      'Access-Control-Allow-Credentials': 'true',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0',
      'Referer': 'https://deepfakemaker.io/nano-banana-ai/'
    };
    
    const instance = axios.create({
      baseURL: 'https://apiv1.deepfakemaker.io/api',
      params: authData,
      headers
    });

    const file = await instance.post('/user/v2/upload-sign', {
      'filename': auth.generateRandomString(32) + '_' + Date.now() + '.jpg',
      'hash': crypto.createHash('sha256').update(buffer).digest('hex'),
      'user_id': userId
    }).then(i => i.data);

    await axios.put(file.data.url, buffer, {
      headers: {
        'content-type': 'image/jpeg',
        'content-length': buffer.length
      }
    });

    const taskData = await instance.post('/replicate/v1/free/nano/banana/task', {
      'prompt': prompt,
      'platform': 'nano_banana',
      'images': [ 'https://cdn.deepfakemaker.io/' + file.data.object_name ],
      'output_format': 'png',
      'user_id': userId
    }).then(i => i.data);

    const progress = await new Promise((resolve, reject) => {
      let retries = 20;
      const interval = setInterval(async () => {
        try {
          const xz = await instance.get('/replicate/v1/free/nano/banana/task', {
            params: {
              user_id: userId,
              ...taskData.data
            }
          }).then(i => i.data);

          if (xz.msg === 'success') {
            clearInterval(interval);
            resolve(xz.data.generate_url);
          }
          if (--retries <= 0) {
            clearInterval(interval);
            reject(new Error('Failed to get task after multiple retries.'));
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, 2500);
    });
    
    return progress;
  } catch (error) {
    throw new Error(error.message);
  }
}

export default function (app) {
  app.get('/ai/tofigure', async (req, res) => {
    try {
      const { imageUrl, prompt } = req.query;

      // Validate required parameters
      if (!imageUrl) {
        return res.status(400).json({
          status: false,
          error: 'Missing required parameter',
          message: 'Please provide imageUrl parameter'
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

      const defaultPrompt = `Create a 1/7 scale commercialized figurine of the characters in the picture, in a realistic style, in a real environment. The figurine is placed on a computer desk. The figurine has a round transparent acrylic base, with no text on the base. The content on the computer screen is the Zbrush modeling process of this figurine. Next to the computer screen is a BANDAI-style toy packaging box printed with the original artwork. The packaging features two-dimensional flat illustrations`;

      // Download image from URL
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });

      // Check if response is an image
      const contentType = imageResponse.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        return res.status(400).json({
          status: false,
          error: 'Invalid image',
          message: 'The provided URL does not point to a valid image'
        });
      }

      const buffer = Buffer.from(imageResponse.data);

      // Check image size (5MB limit)
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          status: false,
          error: 'Image too large',
          message: 'Image must be less than 5MB'
        });
      }

      // Process image with ToFigure AI
      const resultUrl = await convert(buffer, prompt || defaultPrompt);

      res.json({
        status: true,
        creator: "VeronDev",
        result: {
          url: resultUrl,
          prompt: prompt || defaultPrompt
        },
        message: "Image successfully converted to figurine style"
      });

    } catch (error) {
      console.error('ToFigure AI Error:', error);
      
      if (error.response && error.response.status === 404) {
        return res.status(400).json({
          status: false,
          error: 'Image not found',
          message: 'Could not download image from the provided URL'
        });
      }
      
      if (error.code === 'ENOTFOUND') {
        return res.status(400).json({
          status: false,
          error: 'Network error',
          message: 'Could not connect to the image URL'
        });
      }
      
      if (error.message.includes('timeout')) {
        return res.status(408).json({
          status: false,
          error: 'Request timeout',
          message: 'Image download timed out'
        });
      }

      res.status(500).json({
        status: false,
        error: 'Processing failed',
        message: error.message || 'Failed to process image with AI'
      });
    }
  });

  // POST endpoint for flexibility
  app.post('/ai/tofigure', async (req, res) => {
    try {
      const { imageUrl, prompt } = req.body;

      // Validate required parameters
      if (!imageUrl) {
        return res.status(400).json({
          status: false,
          error: 'Missing required parameter',
          message: 'Please provide imageUrl parameter'
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

      const defaultPrompt = `Create a 1/7 scale commercialized figurine of the characters in the picture, in a realistic style, in a real environment. The figurine is placed on a computer desk. The figurine has a round transparent acrylic base, with no text on the base. The content on the computer screen is the Zbrush modeling process of this figurine. Next to the computer screen is a BANDAI-style toy packaging box printed with the original artwork. The packaging features two-dimensional flat illustrations`;

      // Download image from URL
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        validateStatus: function (status) {
          return status >= 200 && status < 400;
        }
      });

      // Check if response is an image
      const contentType = imageResponse.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        return res.status(400).json({
          status: false,
          error: 'Invalid image',
          message: 'The provided URL does not point to a valid image'
        });
      }

      const buffer = Buffer.from(imageResponse.data);

      // Check image size (5MB limit)
      if (buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({
          status: false,
          error: 'Image too large',
          message: 'Image must be less than 5MB'
        });
      }

      // Process image with ToFigure AI
      const resultUrl = await convert(buffer, prompt || defaultPrompt);

      res.json({
        status: true,
        creator: "VeronDev",
        result: {
          url: resultUrl,
          prompt: prompt || defaultPrompt
        },
        message: "Image successfully converted to figurine style"
      });

    } catch (error) {
      console.error('ToFigure AI Error:', error);
      
      if (error.response && error.response.status === 404) {
        return res.status(400).json({
          status: false,
          error: 'Image not found',
          message: 'Could not download image from the provided URL'
        });
      }
      
      res.status(500).json({
        status: false,
        error: 'Processing failed',
        message: error.message || 'Failed to process image with AI'
      });
    }
  });
}