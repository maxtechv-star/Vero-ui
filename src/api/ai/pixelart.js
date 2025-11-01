import axios from 'axios'

class PixelArtGenerator {
  async img2pixel(buffer, ratio = '1:1') {
    if (!buffer || !Buffer.isBuffer(buffer)) throw new Error('Image buffer is required')
    if (!['1:1', '3:2', '2:3'].includes(ratio)) throw new Error('Available ratios: 1:1, 3:2, 2:3')

    const { data: uploadData } = await axios.post('https://pixelartgenerator.app/api/upload/presigned-url', {
      filename: `pixel_${Date.now()}.jpg`,
      contentType: 'image/jpeg',
      type: 'pixel-art-source'
    }, {
      headers: {
        'content-type': 'application/json',
        referer: 'https://pixelartgenerator.app/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
      },
      timeout: 15000
    })

    await axios.put(uploadData.data.uploadUrl, buffer, {
      headers: {
        'content-type': 'image/jpeg',
        'content-length': buffer.length
      },
      timeout: 15000
    })

    const { data: generateData } = await axios.post('https://pixelartgenerator.app/api/pixel/generate', {
      imageKey: uploadData.data.key,
      prompt: '',
      size: ratio,
      type: 'image'
    }, {
      headers: {
        'content-type': 'application/json',
        referer: 'https://pixelartgenerator.app/',
        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
      },
      timeout: 15000
    })

    let attempts = 0
    const maxAttempts = 30
    
    while (attempts < maxAttempts) {
      const { data } = await axios.get(`https://pixelartgenerator.app/api/pixel/status?taskId=${generateData.data.taskId}`, {
        headers: {
          'content-type': 'application/json',
          referer: 'https://pixelartgenerator.app/',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
        },
        timeout: 10000
      })
      
      if (data.data.status === 'SUCCESS') return data.data.images[0]
      attempts++
      await new Promise(res => setTimeout(res, 1000))
    }
    
    throw new Error('Pixel art generation timeout')
  }
}

export default function pixelArtRoute(app) {
    const pixelArt = new PixelArtGenerator()

    app.post("/ai/pixelart", async (req, res) => {
        try {
            const { imageData, ratio = "1:1" } = req.body
            
            if (!imageData) {
                return res.status(400).json({
                    status: false,
                    error: "Image data required",
                    message: "Please provide imageData (base64)"
                })
            }

            if (!['1:1', '3:2', '2:3'].includes(ratio)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid ratio",
                    message: "Available ratios: 1:1, 3:2, 2:3"
                })
            }

            // Convert base64 to buffer
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
            const imageBuffer = Buffer.from(base64Data, 'base64')

            const resultUrl = await pixelArt.img2pixel(imageBuffer, ratio)

            // Download the result image
            const response = await axios.get(resultUrl, { 
                responseType: 'arraybuffer',
                timeout: 15000
            })
            const base64Result = Buffer.from(response.data).toString('base64')
            const dataUrl = `data:image/png;base64,${base64Result}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    ratio: ratio,
                    sourceUrl: resultUrl
                },
                message: "Successfully converted image to pixel art"
            })

        } catch (error) {
            console.error("Pixel Art Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Pixel art conversion failed",
                message: error.message || "An error occurred while converting to pixel art"
            })
        }
    })

    app.get("/ai/pixelart", async (req, res) => {
        try {
            const { imageUrl, ratio = "1:1" } = req.query
            
            if (!imageUrl) {
                return res.status(400).json({
                    status: false,
                    error: "Image URL required",
                    message: "Please provide an imageUrl parameter"
                })
            }

            if (!['1:1', '3:2', '2:3'].includes(ratio)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid ratio",
                    message: "Available ratios: 1:1, 3:2, 2:3"
                })
            }

            // Download image from URL
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })
            const imageBuffer = Buffer.from(response.data)

            const resultUrl = await pixelArt.img2pixel(imageBuffer, ratio)

            // Download the result image
            const resultResponse = await axios.get(resultUrl, { 
                responseType: 'arraybuffer',
                timeout: 15000
            })
            const base64Result = Buffer.from(resultResponse.data).toString('base64')
            const dataUrl = `data:image/png;base64,${base64Result}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    ratio: ratio,
                    sourceUrl: resultUrl
                },
                message: "Successfully converted image to pixel art"
            })

        } catch (error) {
            console.error("Pixel Art Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Pixel art conversion failed",
                message: error.message || "An error occurred while converting to pixel art"
            })
        }
    })
}