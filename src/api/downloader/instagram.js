
import axios from "axios"
import * as cheerio from "cheerio"

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

            const form = new URLSearchParams({ url: url + "&lang=en" })
            const headers = { "Content-Type": "application/x-www-form-urlencoded" }
            
            const response = await axios.post("https://api.downloadgram.app/media", form, { 
                headers,
                timeout: 30000
            })

            const html = (response.data.match(/innerHTML\s*=\s*"([^]+?)";/)?.[1] || "")
                .replace(/\\"/g, '"')
                .replace(/\\n/g, "")
                .replace(/\\t/g, "")
            
            const $ = cheerio.load(html)
            const links = $(".download-items__btn a").map((_, el) => $(el).attr("href")).get()

            if (!links || links.length === 0) {
                return res.status(404).json({
                    status: false,
                    error: "No media found",
                    message: "Could not extract any media from this Instagram post"
                })
            }

            const media = links.filter(link => link).map(link => ({
                url: link,
                type: link.includes(".mp4") ? "video" : "image",
                format: link.includes(".mp4") ? "mp4" : "jpg"
            }))

            res.json({
                status: true,
                data: media,
                message: `Found ${media.length} media items`
            })

        } catch (error) {
            console.error("Instagram Download Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Download failed",
                message: error.message || "An error occurred while downloading from Instagram"
            })
        }
    })
}
