
import axios from "axios"
import FormData from "form-data"

export default function imgPromptRoute(app) {
  app.get("/ai/imgprompt", async (req, res) => {
    try {
      const { imageUrl } = req.query
      
      if (!imageUrl) {
        return res.status(400).json({
          status: false,
          error: "Image URL is required",
          message: "Please provide an imageUrl parameter"
        })
      }

      // Download the image first
      const imageResponse = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!imageResponse.data) {
        return res.status(400).json({
          status: false,
          error: "Failed to download image",
          message: "Could not download image from the provided URL"
        })
      }

      // Create form data for NeuralFrames API
      const form = new FormData()
      form.append("file", imageResponse.data, {
        filename: "image.jpg",
        contentType: "image/jpeg"
      })

      // Send to NeuralFrames API
      const neuralResponse = await axios.post("https://be.neuralframes.com/clip_interrogate/", form, {
        headers: {
          ...form.getHeaders(),
          "Authorization": "Bearer uvcKfXuj6Ygncs6tiSJ6VXLxoapJdjQ3EEsSIt45Zm+vsl8qcLAAOrnnGWYBccx4sbEaQtCr416jxvc/zJNAlcDjLYjfHfHzPpfJ00l05h0oy7twPKzZrO4xSB+YGrmCyb/zOduHh1l9ogFPg/3aeSsz+wZYL9nlXfXdvCqDIP9bLcQMHiUKB0UCGuew2oRt",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
          "Referer": "https://www.neuralframes.com/tools/image-to-prompt"
        },
        timeout: 30000
      })

      const prompt = neuralResponse.data?.caption || neuralResponse.data?.prompt

      if (!prompt) {
        return res.status(500).json({
          status: false,
          error: "No prompt generated",
          message: "The AI could not generate a prompt from this image"
        })
      }

      res.json({
        status: true,
        prompt: prompt
      })

    } catch (error) {
      console.error("Image to Prompt Error:", error.message)
      
      if (error.response?.status === 401) {
        return res.status(500).json({
          status: false,
          error: "API authentication failed",
          message: "The image-to-prompt service is currently unavailable"
        })
      }
      
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          status: false,
          error: "Request timeout",
          message: "The image processing took too long. Please try again."
        })
      }

      res.status(500).json({
        status: false,
        error: "Image processing failed",
        message: error.message || "An error occurred while processing the image"
      })
    }
  })

  // Alternative endpoint for base64 image data
  app.post("/ai/imgprompt", async (req, res) => {
    try {
      const { imageData } = req.body
      
      if (!imageData) {
        return res.status(400).json({
          status: false,
          error: "Image data is required",
          message: "Please provide imageData in base64 format"
        })
      }

      // Convert base64 to buffer
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "")
      const imageBuffer = Buffer.from(base64Data, 'base64')

      // Create form data for NeuralFrames API
      const form = new FormData()
      form.append("file", imageBuffer, {
        filename: "image.jpg",
        contentType: "image/jpeg"
      })

      // Send to NeuralFrames API
      const neuralResponse = await axios.post("https://be.neuralframes.com/clip_interrogate/", form, {
        headers: {
          ...form.getHeaders(),
          "Authorization": "Bearer uvcKfXuj6Ygncs6tiSJ6VXLxoapJdjQ3EEsSIt45Zm+vsl8qcLAAOrnnGWYBccx4sbEaQtCr416jxvc/zJNAlcDjLYjfHfHzPpfJ00l05h0oy7twPKzZrO4xSB+YGrmCyb/zOduHh1l9ogFPg/3aeSsz+wZYL9nlXfXdvCqDIP9bLcQMHiUKB0UCGuew2oRt",
          "User-Agent": "Mozilla/5.0 (Linux; Android 10)",
          "Referer": "https://www.neuralframes.com/tools/image-to-prompt"
        },
        timeout: 30000
      })

      const prompt = neuralResponse.data?.caption || neuralResponse.data?.prompt

      if (!prompt) {
        return res.status(500).json({
          status: false,
          error: "No prompt generated",
          message: "The AI could not generate a prompt from this image"
        })
      }

      res.json({
        status: true,
        prompt: prompt
      })

    } catch (error) {
      console.error("Image to Prompt Error:", error.message)
      
      res.status(500).json({
        status: false,
        error: "Image processing failed",
        message: error.message || "An error occurred while processing the image"
      })
    }
  })
}
