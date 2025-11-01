
import fetch from "node-fetch"

function randomIP() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join(".")
}

async function getToken() {
  const res = await fetch("https://gramfetchr.com/", {
    method: "POST",
    headers: {
      "accept": "text/x-component",
      "content-type": "text/plain;charset=UTF-8",
      "next-action": "00d6c3101978ea75ab0e1c4879ef0c686242515660",
      "next-router-state-tree": "%5B%22%22%2C%7B%22children%22%3A%5B%5B%22locale%22%2C%22en%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D%7D%2Cnull%2Cnull%5D",
      "Referer": "https://gramfetchr.com/"
    },
    body: "[]"
  })
  const text = await res.text()
  const tokenMatch = text.match(/"([a-f0-9]{32}:[a-f0-9]{32})"/)
  if (!tokenMatch) throw new Error("Failed to get token")
  return tokenMatch[1]
}

async function igScraper(url) {
  try {
    const token = await getToken()
    const res = await fetch("https://gramfetchr.com/api/fetchr", {
      method: "POST",
      headers: {
        "accept": "*/*",
        "content-type": "application/json",
        "Referer": "https://gramfetchr.com/"
      },
      body: JSON.stringify({
        url,
        token,
        referer: "https://gramfetchr.com/",
        requester: randomIP()
      })
    })
    const json = await res.json()
    if (!json.success || !json.mediaItems) throw new Error("Failed to get media data")
    return json.mediaItems.map((m, i) => ({
      index: i + 1,
      type: m.isVideo ? "video" : "image",
      download: "https://gramfetchr.com" + m.downloadLink,
      preview: "https://gramfetchr.com" + m.preview,
      thumbnail: "https://gramfetchr.com" + m.thumbnail
    }))
  } catch (e) {
    throw new Error(e.message)
  }
}

export default function instagramDownloaderRoute(app) {
    app.get("/downloader/instagram", async (req, res) => {
        try {
            const { url } = req.query
            
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: "URL parameter is required",
                    message: "Please provide an Instagram URL"
                })
            }

            // Validate Instagram URL
            const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/(p|reel|stories)\/[a-zA-Z0-9_-]+\/?/
            if (!instagramRegex.test(url)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid Instagram URL",
                    message: "Please provide a valid Instagram post, reel, or story URL"
                })
            }

            const mediaItems = await igScraper(url)

            if (!mediaItems || mediaItems.length === 0) {
                return res.status(404).json({
                    status: false,
                    error: "No media found",
                    message: "Could not find any media for this Instagram URL"
                })
            }

            res.json({
                status: true,
                data: {
                    url: url,
                    mediaCount: mediaItems.length,
                    media: mediaItems,
                    types: {
                        images: mediaItems.filter(item => item.type === 'image').length,
                        videos: mediaItems.filter(item => item.type === 'video').length
                    }
                },
                message: `Found ${mediaItems.length} media item(s) from Instagram`
            })

        } catch (error) {
            console.error("Instagram Download Error:", error.message)
            
            if (error.message.includes('Failed to get token')) {
                return res.status(503).json({
                    status: false,
                    error: "Service temporarily unavailable",
                    message: "Instagram download service is currently unavailable. Please try again later."
                })
            }
            
            if (error.message.includes('Failed to get media data')) {
                return res.status(404).json({
                    status: false,
                    error: "Media not found",
                    message: "Could not find media for this Instagram URL. It may be private or deleted."
                })
            }

            res.status(500).json({
                status: false,
                error: "Download failed",
                message: error.message || "An error occurred while processing the Instagram URL"
            })
        }
    })

    // Additional endpoint to get media info without downloading
    app.get("/downloader/instagram/info", async (req, res) => {
        try {
            const { url } = req.query
            
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: "URL parameter is required",
                    message: "Please provide an Instagram URL"
                })
            }

            const instagramRegex = /https?:\/\/(www\.)?instagram\.com\/(p|reel|stories)\/[a-zA-Z0-9_-]+\/?/
            if (!instagramRegex.test(url)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid Instagram URL",
                    message: "Please provide a valid Instagram post, reel, or story URL"
                })
            }

            const mediaItems = await igScraper(url)

            if (!mediaItems || mediaItems.length === 0) {
                return res.status(404).json({
                    status: false,
                    error: "No media found",
                    message: "Could not find any media for this Instagram URL"
                })
            }

            // Extract media info without download links
            const mediaInfo = mediaItems.map(item => ({
                index: item.index,
                type: item.type,
                preview: item.preview,
                thumbnail: item.thumbnail
            }))

            res.json({
                status: true,
                data: {
                    url: url,
                    mediaCount: mediaItems.length,
                    mediaInfo: mediaInfo,
                    types: {
                        images: mediaItems.filter(item => item.type === 'image').length,
                        videos: mediaItems.filter(item => item.type === 'video').length
                    }
                },
                message: `Found ${mediaItems.length} media item(s) from Instagram`
            })

        } catch (error) {
            console.error("Instagram Info Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Info retrieval failed",
                message: error.message || "An error occurred while getting Instagram media info"
            })
        }
    })
      }
