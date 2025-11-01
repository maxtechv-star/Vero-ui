import axios from 'axios'
import FormData from 'form-data'

async function scrapeApiKey() {
  const targetUrl = 'https://overchat.ai/image/ghibli'
  const { data: htmlContent } = await axios.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36'
    },
    timeout: 10000
  })
  const apiKeyRegex = /const apiKey = '([^']+)'/
  const match = htmlContent.match(apiKeyRegex)
  if (!match) throw new Error('API key not found')
  return match[1]
}

async function editImage(buffer, prompt, apiKey) {
  const apiUrl = 'https://api.openai.com/v1/images/edits'
  const form = new FormData()
  form.append('image', buffer, { filename: 'image.png' })
  form.append('prompt', prompt)
  form.append('model', 'gpt-image-1')
  form.append('n', 1)
  form.append('size', '1024x1024')
  form.append('quality', 'medium')

  const response = await axios.post(apiUrl, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${apiKey}`
    },
    timeout: 30000
  })

  const result = response.data
  if (!result?.data?.[0]?.b64_json) throw new Error('Failed to get edited image')
  return Buffer.from(result.data[0].b64_json, 'base64')
}

export default function imageEditorRoute(app) {
    app.post("/ai/imageedit", async (req, res) => {
        try {
            const { imageData, prompt } = req.body
            
            if (!imageData || !prompt) {
                return res.status(400).json({
                    status: false,
                    error: "Missing parameters",
                    message: "Please provide imageData and prompt"
                })
            }

            if (prompt.length < 3) {
                return res.status(400).json({
                    status: false,
                    error: "Prompt too short",
                    message: "Please provide a more detailed prompt"
                })
            }

            const apiKey = await scrapeApiKey()
            
            // Convert base64 to buffer
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
            const imageBuffer = Buffer.from(base64Data, 'base64')

            const resultBuffer = await editImage(imageBuffer, prompt, apiKey)
            const base64Result = resultBuffer.toString('base64')
            const dataUrl = `data:image/png;base64,${base64Result}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    prompt: prompt,
                    style: "custom"
                },
                message: "Image edited successfully"
            })

        } catch (error) {
            console.error("Image Edit Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Image editing failed",
                message: error.message || "An error occurred while editing the image"
            })
        }
    })

    app.post("/ai/ghibli", async (req, res) => {
        try {
            const { imageData } = req.body
            
            if (!imageData) {
                return res.status(400).json({
                    status: false,
                    error: "Image data required",
                    message: "Please provide imageData (base64)"
                })
            }

            const apiKey = await scrapeApiKey()
            const prompt = 'Please convert this image into Studio Ghibli art style'
            
            // Convert base64 to buffer
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
            const imageBuffer = Buffer.from(base64Data, 'base64')

            const resultBuffer = await editImage(imageBuffer, prompt, apiKey)
            const base64Result = resultBuffer.toString('base64')
            const dataUrl = `data:image/png;base64,${base64Result}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    prompt: prompt,
                    style: "ghibli"
                },
                message: "Image converted to Ghibli style successfully"
            })

        } catch (error) {
            console.error("Ghibli Style Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Ghibli conversion failed",
                message: error.message || "An error occurred while converting to Ghibli style"
            })
        }
    })

    app.get("/ai/ghibli", async (req, res) => {
        try {
            const { imageUrl } = req.query
            
            if (!imageUrl) {
                return res.status(400).json({
                    status: false,
                    error: "Image URL required",
                    message: "Please provide an imageUrl parameter"
                })
            }

            const apiKey = await scrapeApiKey()
            const prompt = 'Please convert this image into Studio Ghibli art style'
            
            // Download image from URL
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })
            const imageBuffer = Buffer.from(response.data)

            const resultBuffer = await editImage(imageBuffer, prompt, apiKey)
            const base64Result = resultBuffer.toString('base64')
            const dataUrl = `data:image/png;base64,${base64Result}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    prompt: prompt,
                    style: "ghibli"
                },
                message: "Image converted to Ghibli style successfully"
            })

        } catch (error) {
            console.error("Ghibli Style Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Ghibli conversion failed",
                message: error.message || "An error occurred while converting to Ghibli style"
            })
        }
    })
}