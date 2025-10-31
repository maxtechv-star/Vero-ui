import yts from "yt-search"

export default function youtubeSearchRoute(app) {
  app.get("/search/youtubesearch", async (req, res) => {
    try {
      const { query } = req.query
      
      if (!query) {
        return res.status(400).json({
          status: false,
          error: "Query parameter is required",
          message: "Please provide a search query"
        })
      }

      const searchResults = await yts(query)
      const videos = searchResults.videos

      if (videos.length === 0) {
        return res.status(404).json({
          status: false,
          error: "No results found",
          message: `No YouTube results found for "${query}"`
        })
      }

      const results = videos.map(video => ({
        title: video.title,
        url: video.url,
        videoId: video.videoId,
        channel: video.author.name,
        thumbnail: video.thumbnail,
        duration: video.timestamp,
        views: video.views,
        uploaded: video.ago
      }))

      res.json({
        status: true,
        data: results,
        count: results.length,
        query: query,
        message: `Found ${results.length} YouTube results`
      })

    } catch (error) {
      console.error("YouTube Search Error:", error.message)
      
      res.status(500).json({
        status: false,
        error: "Search failed",
        message: error.message || "An error occurred while searching YouTube"
      })
    }
  })
}