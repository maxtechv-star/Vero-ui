import axios from 'axios'

export default function webPilotRoute(app) {
    app.get("/ai/webpilot", async (req, res) => {
        try {
            const { query } = req.query
            
            if (!query) {
                return res.status(400).json({
                    status: false,
                    error: "Query parameter is required",
                    message: "Please provide a search query"
                })
            }

            const { data } = await axios.post(
                'https://api.webpilotai.com/rupee/v1/search',
                {
                    q: query,
                    threadId: ''
                },
                {
                    headers: {
                        authority: 'api.webpilotai.com',
                        accept: 'application/json, text/plain, */*, text/event-stream',
                        'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                        authorization: 'Bearer null',
                        'cache-control': 'no-cache',
                        'content-type': 'application/json;charset=UTF-8',
                        origin: 'https://www.webpilot.ai',
                        pragma: 'no-cache',
                        referer: 'https://www.webpilot.ai/',
                        'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
                    },
                    timeout: 30000
                }
            )

            let chat = ''
            const lines = data.split('\n')
            
            lines.forEach(line => {
                if (line.startsWith('data:')) {
                    try {
                        const json = JSON.parse(line.slice(5))
                        if (
                            json.type === 'data' &&
                            json.data?.section_id === void 0 &&
                            json.data?.content
                        ) {
                            chat += json.data.content
                        }
                    } catch (error) {
                        // Skip invalid JSON lines
                    }
                }
            })

            if (!chat.trim()) {
                return res.status(404).json({
                    status: false,
                    error: "No response from AI",
                    message: "The AI did not provide a response for your query"
                })
            }

            res.json({
                status: true,
                data: {
                    query: query,
                    response: chat.trim()
                },
                message: "Web search completed successfully"
            })

        } catch (error) {
            console.error("WebPilot AI Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Web search failed",
                message: error.message || "An error occurred during web search"
            })
        }
    })
}