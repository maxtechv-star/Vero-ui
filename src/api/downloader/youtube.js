import axios from "axios"

export default function youtubeCliptoRoute(app) {
  // Main YouTube downloader endpoint
  app.get("/downloader/youtube", async (req, res) => {
    try {
      const { url, type = "all", quality = "highest" } = req.query
      
      if (!url) {
        return res.status(400).json({
          status: false,
          error: "URL parameter is required",
          message: "Please provide a YouTube video URL"
        })
      }

      // Validate YouTube URL
      const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      if (!youtubeRegex.test(url)) {
        return res.status(400).json({
          status: false,
          error: "Invalid YouTube URL",
          message: "Please provide a valid YouTube video URL"
        })
      }

      const response = await axios.post(
        "https://www.clipto.com/api/youtube", 
        { url }, 
        {
          headers: {
            "content-type": "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
            "Referer": "https://www.clipto.com/id/media-downloader/youtube-audio-downloader",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive"
          },
          timeout: 30000,
          responseType: "text"
        }
      )

      const html = typeof response.data === "string" ? response.data : JSON.stringify(response.data)
      
      // Extract video information
      const title = html.match(/"title":"(.*?)"/)?.[1] || "No title"
      const author = html.match(/"author":"(.*?)"/)?.[1] || "Unknown"
      const thumbnail = html.match(/"thumbnail":"(https:[^"]+)"/)?.[1] || null
      const duration = html.match(/"duration":"(.*?)"/)?.[1] || null

      // Extract all media formats
      const allFormats = []
      const mediaRegex = /(\{[^{}]*?"type":"(?:video|audio)"[^{}]*?\})/g
      const matches = html.matchAll(mediaRegex)

      for (const match of matches) {
        const text = match[1]
        const media = {
          formatId: text.match(/"formatId":(\d+)/)?.[1] || null,
          label: text.match(/"label":"(.*?)"/)?.[1] || null,
          type: text.match(/"type":"(.*?)"/)?.[1] || null,
          ext: text.match(/"ext":"(.*?)"/)?.[1] || null,
          quality: text.match(/"quality":"(.*?)"/)?.[1] || null,
          width: text.match(/"width":(\d+)/)?.[1] || null,
          height: text.match(/"height":(\d+)/)?.[1] || null,
          url: text.match(/"url":"(https:[^"]+)"/)?.[1]?.replace(/\\u0026/g, "&") || null
        }
        
        if (media.url) {
          allFormats.push(media)
        }
      }

      if (allFormats.length === 0) {
        return res.status(404).json({
          status: false,
          error: "No media found",
          message: "Could not extract any media formats from this video"
        })
      }

      // Separate audio and video formats
      const audioFormats = allFormats.filter(media => media.type === "audio")
      const videoFormats = allFormats.filter(media => media.type === "video")

      // Filter based on type parameter
      let resultFormats = []
      let resultType = ""

      if (type === "audio") {
        resultFormats = audioFormats
        resultType = "audio"
      } else if (type === "video") {
        resultFormats = videoFormats
        resultType = "video"
      } else {
        resultFormats = allFormats
        resultType = "all"
      }

      if (resultFormats.length === 0) {
        return res.status(404).json({
          status: false,
          error: `No ${type} formats found`,
          message: `Could not extract ${type} formats from this video`
        })
      }

      // Sort by quality
      resultFormats.sort((a, b) => {
        const getQualityValue = (media) => {
          if (media.type === "audio") {
            // For audio, use bitrate from label
            if (media.label && media.label.match(/\d+/)) return parseInt(media.label.match(/\d+/)[0])
            return 0
          } else {
            // For video, use resolution
            if (media.height) return parseInt(media.height)
            if (media.quality === "hd") return 1080
            if (media.quality === "sd") return 720
            if (media.label && media.label.match(/\d+/)) return parseInt(media.label.match(/\d+/)[0])
            return 0
          }
        }
        return getQualityValue(b) - getQualityValue(a)
      })

      // Select best/worst quality if requested
      let finalFormats = resultFormats
      if (quality === "highest" && resultFormats.length > 0) {
        finalFormats = [resultFormats[0]]
      } else if (quality === "lowest" && resultFormats.length > 0) {
        finalFormats = [resultFormats[resultFormats.length - 1]]
      }

      res.json({
        status: true,
        data: {
          title,
          author,
          thumbnail,
          duration,
          videoUrl: url,
          type: resultType,
          formats: finalFormats,
          totalFormats: finalFormats.length,
          available: {
            audio: audioFormats.length,
            video: videoFormats.length,
            total: allFormats.length
          }
        },
        message: `Successfully extracted ${finalFormats.length} ${resultType} format(s) from YouTube video`
      })

    } catch (error) {
      console.error("YouTube Downloader Error:", error.message)
      
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          status: false,
          error: "Request timeout",
          message: "YouTube download service took too long to respond"
        })
      }
      
      if (error.response?.status === 404) {
        return res.status(404).json({
          status: false,
          error: "Video not found",
          message: "The YouTube video could not be found or is not accessible"
        })
      }

      res.status(500).json({
        status: false,
        error: "Download failed",
        message: error.message || "An error occurred while processing the YouTube video"
      })
    }
  })

  // Audio-only endpoint (convenience endpoint)
  app.get("/downloader/youtube/audio", async (req, res) => {
    try {
      const { url, quality = "highest" } = req.query
      
      if (!url) {
        return res.status(400).json({
          status: false,
          error: "URL parameter is required",
          message: "Please provide a YouTube video URL"
        })
      }

      const response = await axios.post(
        "https://www.clipto.com/api/youtube", 
        { url }, 
        {
          headers: {
            "content-type": "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
            "Referer": "https://www.clipto.com/id/media-downloader/youtube-audio-downloader"
          },
          timeout: 30000,
          responseType: "text"
        }
      )

      const html = typeof response.data === "string" ? response.data : JSON.stringify(response.data)
      
      // Extract video information
      const title = html.match(/"title":"(.*?)"/)?.[1] || "No title"
      const author = html.match(/"author":"(.*?)"/)?.[1] || "Unknown"
      const thumbnail = html.match(/"thumbnail":"(https:[^"]+)"/)?.[1] || null
      const duration = html.match(/"duration":"(.*?)"/)?.[1] || null

      // Extract only audio formats
      const audioFormats = []
      const mediaRegex = /(\{[^{}]*?"type":"(?:video|audio)"[^{}]*?\})/g
      const matches = html.matchAll(mediaRegex)

      for (const match of matches) {
        const text = match[1]
        const mediaType = text.match(/"type":"(.*?)"/)?.[1]
        
        if (mediaType === "audio") {
          const media = {
            formatId: text.match(/"formatId":(\d+)/)?.[1] || null,
            label: text.match(/"label":"(.*?)"/)?.[1] || null,
            type: mediaType,
            ext: text.match(/"ext":"(.*?)"/)?.[1] || null,
            quality: text.match(/"quality":"(.*?)"/)?.[1] || null,
            url: text.match(/"url":"(https:[^"]+)"/)?.[1]?.replace(/\\u0026/g, "&") || null
          }
          
          if (media.url) {
            audioFormats.push(media)
          }
        }
      }

      if (audioFormats.length === 0) {
        return res.status(404).json({
          status: false,
          error: "No audio formats found",
          message: "Could not extract audio from this video"
        })
      }

      // Sort audio by quality (bitrate)
      audioFormats.sort((a, b) => {
        const getBitrate = (media) => {
          if (media.label && media.label.match(/\d+/)) return parseInt(media.label.match(/\d+/)[0])
          return 0
        }
        return getBitrate(b) - getBitrate(a)
      })

      // Select best/worst quality
      let resultFormats = audioFormats
      if (quality === "highest" && audioFormats.length > 0) {
        resultFormats = [audioFormats[0]]
      } else if (quality === "lowest" && audioFormats.length > 0) {
        resultFormats = [audioFormats[audioFormats.length - 1]]
      }

      res.json({
        status: true,
        data: {
          title,
          author,
          thumbnail,
          duration,
          videoUrl: url,
          type: "audio",
          formats: resultFormats,
          totalFormats: resultFormats.length
        },
        message: `Successfully extracted ${resultFormats.length} audio format(s) from YouTube video`
      })

    } catch (error) {
      console.error("YouTube Audio Downloader Error:", error.message)
      
      res.status(500).json({
        status: false,
        error: "Audio extraction failed",
        message: error.message || "An error occurred while extracting audio from YouTube video"
      })
    }
  })

  // Video-only endpoint (convenience endpoint)
  app.get("/downloader/youtube/video", async (req, res) => {
    try {
      const { url, quality = "highest" } = req.query
      
      if (!url) {
        return res.status(400).json({
          status: false,
          error: "URL parameter is required",
          message: "Please provide a YouTube video URL"
        })
      }

      const response = await axios.post(
        "https://www.clipto.com/api/youtube", 
        { url }, 
        {
          headers: {
            "content-type": "application/json",
            "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
            "Referer": "https://www.clipto.com/id/media-downloader/youtube-audio-downloader"
          },
          timeout: 30000,
          responseType: "text"
        }
      )

      const html = typeof response.data === "string" ? response.data : JSON.stringify(response.data)
      
      // Extract video information
      const title = html.match(/"title":"(.*?)"/)?.[1] || "No title"
      const author = html.match(/"author":"(.*?)"/)?.[1] || "Unknown"
      const thumbnail = html.match(/"thumbnail":"(https:[^"]+)"/)?.[1] || null
      const duration = html.match(/"duration":"(.*?)"/)?.[1] || null

      // Extract only video formats
      const videoFormats = []
      const mediaRegex = /(\{[^{}]*?"type":"(?:video|audio)"[^{}]*?\})/g
      const matches = html.matchAll(mediaRegex)

      for (const match of matches) {
        const text = match[1]
        const mediaType = text.match(/"type":"(.*?)"/)?.[1]
        
        if (mediaType === "video") {
          const media = {
            formatId: text.match(/"formatId":(\d+)/)?.[1] || null,
            label: text.match(/"label":"(.*?)"/)?.[1] || null,
            type: mediaType,
            ext: text.match(/"ext":"(.*?)"/)?.[1] || null,
            quality: text.match(/"quality":"(.*?)"/)?.[1] || null,
            width: text.match(/"width":(\d+)/)?.[1] || null,
            height: text.match(/"height":(\d+)/)?.[1] || null,
            url: text.match(/"url":"(https:[^"]+)"/)?.[1]?.replace(/\\u0026/g, "&") || null
          }
          
          if (media.url) {
            videoFormats.push(media)
          }
        }
      }

      if (videoFormats.length === 0) {
        return res.status(404).json({
          status: false,
          error: "No video formats found",
          message: "Could not extract video from this URL"
        })
      }

      // Sort video by resolution
      videoFormats.sort((a, b) => {
        const getResolution = (media) => {
          if (media.height) return parseInt(media.height)
          if (media.quality === "hd") return 1080
          if (media.quality === "sd") return 720
          if (media.label && media.label.match(/\d+/)) return parseInt(media.label.match(/\d+/)[0])
          return 0
        }
        return getResolution(b) - getResolution(a)
      })

      // Select best/worst quality
      let resultFormats = videoFormats
      if (quality === "highest" && videoFormats.length > 0) {
        resultFormats = [videoFormats[0]]
      } else if (quality === "lowest" && videoFormats.length > 0) {
        resultFormats = [videoFormats[videoFormats.length - 1]]
      }

      res.json({
        status: true,
        data: {
          title,
          author,
          thumbnail,
          duration,
          videoUrl: url,
          type: "video",
          formats: resultFormats,
          totalFormats: resultFormats.length
        },
        message: `Successfully extracted ${resultFormats.length} video format(s) from YouTube video`
      })

    } catch (error) {
      console.error("YouTube Video Downloader Error:", error.message)
      
      res.status(500).json({
        status: false,
        error: "Video extraction failed",
        message: error.message || "An error occurred while extracting video from YouTube"
      })
    }
  })
}