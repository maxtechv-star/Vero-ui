import axios from 'axios'
import FormData from 'form-data'
import crypto from 'crypto'

const BASE_URL = 'https://ai-apps.codergautam.dev'
const PROMPT = 'a commercial 1/7 scale figurine of the character in the picture was created, depicting a realistic style and a realistic environment. The figurine is placed on a computer desk with a round transparent acrylic base. There is no text on the base. The computer screen shows the Zbrush modeling process of the figurine. Next to the computer screen is a BANDAI-style toy box with the original painting printed on it.'

function acakName(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function autoregist() {
  const uid = crypto.randomBytes(12).toString('hex')
  const email = `gienetic${Date.now()}@nyahoo.com`

  const payload = {
    uid,
    email,
    displayName: acakName(),
    photoURL: 'https://i.pravatar.cc/150',
    appId: 'photogpt'
  }

  const res = await axios.post(`${BASE_URL}/photogpt/create-user`, payload, {
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
      'user-agent': 'okhttp/4.9.2'
    },
    timeout: 15000
  })

  if (res.data.success) return uid
  throw new Error('Registration failed: ' + JSON.stringify(res.data))
}

async function img2img(imageBuffer, prompt) {
  const uid = await autoregist()

  const form = new FormData()
  form.append('image', imageBuffer, { filename: 'input.jpg', contentType: 'image/jpeg' })
  form.append('prompt', prompt)
  form.append('userId', uid)

  const uploadRes = await axios.post(`${BASE_URL}/photogpt/generate-image`, form, {
    headers: {
      ...form.getHeaders(),
      'accept': 'application/json',
      'user-agent': 'okhttp/4.9.2',
      'accept-encoding': 'gzip'
    },
    timeout: 30000
  })

  if (!uploadRes.data.success) throw new Error(JSON.stringify(uploadRes.data))

  const { pollingUrl } = uploadRes.data
  let status = 'pending'
  let resultUrl = null
  let attempts = 0
  const maxAttempts = 20 // 60 seconds max

  while (status !== 'Ready' && attempts < maxAttempts) {
    const pollRes = await axios.get(pollingUrl, {
      headers: { 'accept': 'application/json', 'user-agent': 'okhttp/4.9.2' },
      timeout: 10000
    })
    status = pollRes.data.status
    if (status === 'Ready') {
      resultUrl = pollRes.data.result.url
      break
    }
    attempts++
    await new Promise(r => setTimeout(r, 3000))
  }

  if (!resultUrl) throw new Error('Failed to get result image - timeout')

  const resultImg = await axios.get(resultUrl, { 
    responseType: 'arraybuffer',
    timeout: 15000
  })
  return Buffer.from(resultImg.data)
}

export default function toFigureRoute(app) {
    app.post("/ai/tofigure", async (req, res) => {
        try {
            const { imageUrl, imageData } = req.body
            
            if (!imageUrl && !imageData) {
                return res.status(400).json({
                    status: false,
                    error: "Image data required",
                    message: "Please provide either imageUrl or imageData (base64)"
                })
            }

            let imageBuffer

            if (imageUrl) {
                // Download image from URL
                try {
                    const response = await axios.get(imageUrl, {
                        responseType: 'arraybuffer',
                        timeout: 15000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    })
                    imageBuffer = Buffer.from(response.data)
                } catch (error) {
                    return res.status(400).json({
                        status: false,
                        error: "Failed to download image",
                        message: "Could not download image from the provided URL"
                    })
                }
            } else if (imageData) {
                // Convert base64 to buffer
                try {
                    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
                    imageBuffer = Buffer.from(base64Data, 'base64')
                } catch (error) {
                    return res.status(400).json({
                        status: false,
                        error: "Invalid image data",
                        message: "Please provide valid base64 image data"
                    })
                }
            }

            // Validate image buffer
            if (!imageBuffer || imageBuffer.length === 0) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid image",
                    message: "The provided image data is invalid or empty"
                })
            }

            // Process image
            const resultBuffer = await img2img(imageBuffer, PROMPT)

            // Convert result to base64
            const base64Result = resultBuffer.toString('base64')
            const dataUrl = `data:image/png;base64,${base64Result}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    prompt: PROMPT,
                    description: "Image converted to figurine style with realistic environment"
                },
                message: "Successfully converted image to figurine style"
            })

        } catch (error) {
            console.error("To Figure Error:", error.message)
            
            if (error.code === 'ECONNABORTED') {
                return res.status(408).json({
                    status: false,
                    error: "Request timeout",
                    message: "Image processing took too long. Please try again."
                })
            }

            if (error.message.includes('Registration failed')) {
                return res.status(500).json({
                    status: false,
                    error: "Service unavailable",
                    message: "AI service is currently unavailable. Please try again later."
                })
            }

            res.status(500).json({
                status: false,
                error: "Image processing failed",
                message: error.message || "An error occurred while processing the image"
            })
        }
    })

    // GET endpoint for URL-based image processing
    app.get("/ai/tofigure", async (req, res) => {
        try {
            const { imageUrl } = req.query
            
            if (!imageUrl) {
                return res.status(400).json({
                    status: false,
                    error: "Image URL required",
                    message: "Please provide an imageUrl parameter"
                })
            }

            // Download image from URL
            let imageBuffer
            try {
                const response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                })
                imageBuffer = Buffer.from(response.data)
            } catch (error) {
                return res.status(400).json({
                    status: false,
                    error: "Failed to download image",
                    message: "Could not download image from the provided URL"
                })
            }

            // Process image
            const resultBuffer = await img2img(imageBuffer, PROMPT)

            // Convert result to base64
            const base64Result = resultBuffer.toString('base64')
            const dataUrl = `data:image/png;base64,${base64Result}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    prompt: PROMPT,
                    description: "Image converted to figurine style with realistic environment"
                },
                message: "Successfully converted image to figurine style"
            })

        } catch (error) {
            console.error("To Figure Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Image processing failed",
                message: error.message || "An error occurred while processing the image"
            })
        }
    })
}