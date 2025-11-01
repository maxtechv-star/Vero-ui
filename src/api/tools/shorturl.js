import axios from 'axios'
import qs from 'querystring'
import zlib from 'zlib'

export default function shortUrlRoute(app) {
    app.get("/tools/shorturl", async (req, res) => {
        try {
            const { url } = req.query
            
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: "URL parameter is required",
                    message: "Please provide a URL to shorten"
                })
            }

            // Validate URL format
            try {
                new URL(url)
            } catch (e) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid URL",
                    message: "Please provide a valid URL (include http:// or https://)"
                })
            }

            const result = await kualatshort(url)
            
            if (!result.data || !result.data.shorturl) {
                return res.status(500).json({
                    status: false,
                    error: "Shortening failed",
                    message: "URL shortening service returned an invalid response"
                })
            }

            res.json({
                status: true,
                data: {
                    originalUrl: url,
                    shortUrl: result.data.shorturl,
                    service: "kua.lat"
                },
                message: "URL shortened successfully"
            })

        } catch (error) {
            console.error("URL Shortener Error:", error.message)
            
            if (error.response?.status === 400) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid URL",
                    message: "The URL shortening service rejected the URL"
                })
            }

            res.status(500).json({
                status: false,
                error: "URL shortening failed",
                message: error.message || "An error occurred while shortening the URL"
            })
        }
    })

    // Additional endpoint for bulk URL shortening
    app.post("/tools/shorturl/bulk", async (req, res) => {
        try {
            const { urls } = req.body
            
            if (!urls || !Array.isArray(urls)) {
                return res.status(400).json({
                    status: false,
                    error: "URLs array is required",
                    message: "Please provide an array of URLs to shorten"
                })
            }

            if (urls.length > 10) {
                return res.status(400).json({
                    status: false,
                    error: "Too many URLs",
                    message: "Maximum 10 URLs allowed per request"
                })
            }

            const results = []
            const errors = []

            for (const url of urls) {
                try {
                    // Validate URL
                    new URL(url)
                    const result = await kualatshort(url)
                    
                    if (result.data && result.data.shorturl) {
                        results.push({
                            originalUrl: url,
                            shortUrl: result.data.shorturl,
                            status: "success"
                        })
                    } else {
                        errors.push({
                            url: url,
                            error: "Invalid response from service"
                        })
                    }
                } catch (error) {
                    errors.push({
                        url: url,
                        error: error.message
                    })
                }
            }

            res.json({
                status: true,
                data: {
                    successful: results,
                    failed: errors
                },
                total: urls.length,
                successful: results.length,
                failed: errors.length,
                message: `Successfully shortened ${results.length} out of ${urls.length} URLs`
            })

        } catch (error) {
            console.error("Bulk URL Shortener Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Bulk URL shortening failed",
                message: error.message || "An error occurred while processing URLs"
            })
        }
    })
}

async function kualatshort(url) {
    const res = await axios.post(
        'https://kua.lat/shorten',
        qs.stringify({ url }),
        {
            responseType: 'arraybuffer',
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Origin': 'https://kua.lat',
                'Referer': 'https://kua.lat/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 15000
        }
    )

    let decoded
    const encoding = res.headers['content-encoding']

    if (encoding === 'br') {
        decoded = zlib.brotliDecompressSync(res.data)
    } else if (encoding === 'gzip') {
        decoded = zlib.gunzipSync(res.data)
    } else if (encoding === 'deflate') {
        decoded = zlib.inflateSync(res.data)
    } else {
        decoded = res.data
    }

    return JSON.parse(decoded.toString())
}