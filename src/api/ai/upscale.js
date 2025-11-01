import axios from 'axios'
import FormData from 'form-data'

const availableScaleRatio = [2, 4]

const imgupscale = {
  req: async (imageBuffer, scaleRatio) => {
    const form = new FormData()
    form.append('myfile', imageBuffer, { filename: `upscale_${Date.now()}.jpg` })
    form.append('scaleRadio', scaleRatio.toString())

    const response = await axios.request({
      method: 'POST',
      url: 'https://get1.imglarger.com/api/UpscalerNew/UploadNew',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'origin': 'https://imgupscaler.com',
        'referer': 'https://imgupscaler.com/',
        ...form.getHeaders()
      },
      data: form,
      timeout: 30000
    })

    return response.data
  },

  cek: async (code, scaleRatio) => {
    const response = await axios.request({
      method: 'POST',
      url: 'https://get1.imglarger.com/api/UpscalerNew/CheckStatusNew',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'origin': 'https://imgupscaler.com',
        'referer': 'https://imgupscaler.com/'
      },
      data: JSON.stringify({ code, scaleRadio: scaleRatio }),
      timeout: 15000
    })

    return response.data
  },

  upscale: async (imageBuffer, scaleRatio, maxRetries = 30, retryDelay = 2000) => {
    const uploadResult = await imgupscale.req(imageBuffer, scaleRatio)
    if (uploadResult.code !== 200) {
      throw new Error(`Upload failed: ${uploadResult.msg}`)
    }

    const { code } = uploadResult.data
    for (let i = 0; i < maxRetries; i++) {
      const statusResult = await imgupscale.cek(code, scaleRatio)

      if (statusResult.code === 200 && statusResult.data.status === 'success') {
        return {
          success: true,
          downloadUrls: statusResult.data.downloadUrls
        }
      }

      if (statusResult.data.status === 'error') {
        throw new Error('Processing failed on server')
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }

    throw new Error('Processing timeout - maximum retries exceeded')
  }
}

export default function imageUpscaleRoute(app) {
    app.post("/ai/upscale", async (req, res) => {
        try {
            const { imageData, scale = "2" } = req.body
            
            if (!imageData) {
                return res.status(400).json({
                    status: false,
                    error: "Image data required",
                    message: "Please provide imageData (base64)"
                })
            }

            const scaleNum = parseInt(scale)
            if (!availableScaleRatio.includes(scaleNum)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid scale",
                    message: "Available scales: 2, 4"
                })
            }

            // Convert base64 to buffer
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
            const imageBuffer = Buffer.from(base64Data, 'base64')

            const result = await imgupscale.upscale(imageBuffer, scaleNum)

            if (!result.success || !result.downloadUrls?.length) {
                throw new Error('Upscaling failed - no download URLs received')
            }

            // Download the upscaled image
            const response = await axios.get(result.downloadUrls[0], {
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
                    scale: `${scaleNum}x`,
                    downloadUrl: result.downloadUrls[0],
                    allUrls: result.downloadUrls
                },
                message: `Image upscaled successfully to ${scaleNum}x`
            })

        } catch (error) {
            console.error("Image Upscale Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Image upscaling failed",
                message: error.message || "An error occurred while upscaling the image"
            })
        }
    })

    app.get("/ai/upscale", async (req, res) => {
        try {
            const { imageUrl, scale = "2" } = req.query
            
            if (!imageUrl) {
                return res.status(400).json({
                    status: false,
                    error: "Image URL required",
                    message: "Please provide an imageUrl parameter"
                })
            }

            const scaleNum = parseInt(scale)
            if (!availableScaleRatio.includes(scaleNum)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid scale",
                    message: "Available scales: 2, 4"
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

            const result = await imgupscale.upscale(imageBuffer, scaleNum)

            if (!result.success || !result.downloadUrls?.length) {
                throw new Error('Upscaling failed - no download URLs received')
            }

            // Download the upscaled image
            const upscaleResponse = await axios.get(result.downloadUrls[0], {
                responseType: 'arraybuffer',
                timeout: 15000
            })
            const base64Result = Buffer.from(upscaleResponse.data).toString('base64')
            const dataUrl = `data:image/png;base64,${base64Result}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    scale: `${scaleNum}x`,
                    downloadUrl: result.downloadUrls[0],
                    allUrls: result.downloadUrls
                },
                message: `Image upscaled successfully to ${scaleNum}x`
            })

        } catch (error) {
            console.error("Image Upscale Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Image upscaling failed",
                message: error.message || "An error occurred while upscaling the image"
            })
        }
    })
}