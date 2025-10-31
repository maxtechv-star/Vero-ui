import axios from "axios"
import cheerio from "cheerio"

export default function appleMusicRoute(app) {
  app.get("/search/applemusic", async (req, res) => {
    try {
      const { query, region = "us" } = req.query
      
      if (!query) {
        return res.status(400).json({
          status: false,
          error: "Query parameter is required",
          message: "Please provide a search query"
        })
      }

      if (query.length < 2) {
        return res.status(400).json({
          status: false,
          error: "Query too short",
          message: "Search query must be at least 2 characters long"
        })
      }

      const response = await axios.get(
        `https://music.apple.com/${region}/search?term=${encodeURIComponent(query)}`,
        {
          timeout: 30000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Cache-Control": "max-age=0"
          }
        }
      )

      const $ = cheerio.load(response.data)
      const results = []

      // Search for music results
      $(".search-lockup").each((_, element) => {
        const title = $(element).find(".chart-list-item__title").text().trim() || 
                     $(element).find(".search-lockup__title").text().trim()
        
        const artist = $(element).find(".chart-list-item__artist").text().trim() || 
                      $(element).find(".search-lockup__subtitle").text().trim()
        
        const linkElement = $(element).find("a").first()
        const link = linkElement.attr("href")
        
        const imageElement = $(element).find("img, picture source")
        const image = imageElement.attr("src") || 
                     imageElement.attr("srcset")?.split(" ")[0] ||
                     imageElement.attr("data-src")

        if (title && artist && link) {
          results.push({
            title,
            artist,
            link: link.startsWith("http") ? link : `https://music.apple.com${link}`,
            image: image ? (image.startsWith("http") ? image : `https://music.apple.com${image}`) : null,
            type: "music"
          })
        }
      })

      // Alternative selector for top results
      $(".top-search-lockup").each((_, element) => {
        const title = $(element).find(".top-search-lockup__primary__title").text().trim()
        const artist = $(element).find(".top-search-lockup__secondary").text().trim()
        const linkElement = $(element).find(".click-action, a").first()
        const link = linkElement.attr("href")
        
        const imageElement = $(element).find("picture source, img")
        const image = imageElement.attr("srcset")?.split(" ")[0] || 
                     imageElement.attr("src") ||
                     imageElement.attr("data-src")

        if (title && artist && link) {
          results.push({
            title,
            artist,
            link: link.startsWith("http") ? link : `https://music.apple.com${link}`,
            image: image ? (image.startsWith("http") ? image : `https://music.apple.com${image}`) : null,
            type: "top-result"
          })
        }
      })

      // Remove duplicates based on title and artist
      const uniqueResults = results.filter((result, index, self) =>
        index === self.findIndex(r => 
          r.title === result.title && r.artist === result.artist
        )
      )

      if (uniqueResults.length === 0) {
        return res.status(404).json({
          status: false,
          error: "No results found",
          message: `No Apple Music results found for "${query}" in region ${region}`,
          query: query,
          region: region
        })
      }

      res.json({
        status: true,
        data: uniqueResults,
        count: uniqueResults.length,
        query: query,
        region: region,
        source: "music.apple.com",
        message: `Found ${uniqueResults.length} results for "${query}"`
      })

    } catch (error) {
      console.error("Apple Music Search Error:", error.message)
      
      if (error.code === 'ECONNABORTED') {
        return res.status(408).json({
          status: false,
          error: "Request timeout",
          message: "Apple Music search took too long. Please try again."
        })
      }
      
      if (error.response?.status === 404) {
        return res.status(404).json({
          status: false,
          error: "No results found",
          message: "No results found for your search query"
        })
      }

      res.status(500).json({
        status: false,
        error: "Search failed",
        message: error.message || "An error occurred while searching Apple Music"
      })
    }
  })

  // Additional endpoint for batch search
  app.get("/search/applemusic/batch", async (req, res) => {
    try {
      const { queries, region = "us" } = req.query
      
      if (!queries) {
        return res.status(400).json({
          status: false,
          error: "Queries parameter is required",
          message: "Please provide search queries as a comma-separated list"
        })
      }

      const queryList = queries.split(',').map(q => q.trim()).filter(q => q.length >= 2)
      
      if (queryList.length === 0) {
        return res.status(400).json({
          status: false,
          error: "No valid queries",
          message: "Please provide valid search queries (at least 2 characters each)"
        })
      }

      if (queryList.length > 5) {
        return res.status(400).json({
          status: false,
          error: "Too many queries",
          message: "Maximum 5 queries allowed per batch request"
        })
      }

      const results = {}
      
      for (const query of queryList) {
        try {
          const response = await axios.get(
            `https://music.apple.com/${region}/search?term=${encodeURIComponent(query)}`,
            {
              timeout: 15000,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
              }
            }
          )

          const $ = cheerio.load(response.data)
          const searchResults = []

          $(".search-lockup, .top-search-lockup").each((_, element) => {
            const title = $(element).find(".chart-list-item__title, .search-lockup__title, .top-search-lockup__primary__title").text().trim()
            const artist = $(element).find(".chart-list-item__artist, .search-lockup__subtitle, .top-search-lockup__secondary").text().trim()
            const linkElement = $(element).find("a").first()
            const link = linkElement.attr("href")
            
            const imageElement = $(element).find("img, picture source")
            const image = imageElement.attr("src") || 
                         imageElement.attr("srcset")?.split(" ")[0] ||
                         imageElement.attr("data-src")

            if (title && artist && link) {
              searchResults.push({
                title,
                artist,
                link: link.startsWith("http") ? link : `https://music.apple.com${link}`,
                image: image ? (image.startsWith("http") ? image : `https://music.apple.com${image}`) : null
              })
            }
          })

          // Remove duplicates
          const uniqueResults = searchResults.filter((result, index, self) =>
            index === self.findIndex(r => 
              r.title === result.title && r.artist === result.artist
            )
          )

          results[query] = uniqueResults.slice(0, 10) // Limit to 10 results per query

        } catch (error) {
          results[query] = {
            error: error.message,
            results: []
          }
        }
      }

      res.json({
        status: true,
        data: results,
        total_queries: queryList.length,
        region: region,
        message: `Batch search completed for ${queryList.length} queries`
      })

    } catch (error) {
      console.error("Apple Music Batch Search Error:", error.message)
      
      res.status(500).json({
        status: false,
        error: "Batch search failed",
        message: error.message || "An error occurred during batch search"
      })
    }
  })
        }
