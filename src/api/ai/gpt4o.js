import axios from 'axios';

function pickRandom(list) {
  return list[Math.floor(list.length * Math.random())]
}

export default function gpt4oRoute(app) {
    app.get("/ai/gpt4o", async (req, res) => {
        try {
            const { query } = req.query
            
            if (!query) {
                return res.status(400).json({
                    status: false,
                    error: "Query parameter is required",
                    message: "Please provide a query"
                })
            }

            const apiKey = [
                '662413cf9b2e4a09b8175abf38853f1c',
                'e7956e69c5634672982005bde27e9223',
                '077cf44364ac4c32b8263482ef4371f1',
                '53f034d6af90448eb08b9fd57306ca15',
                '99fca1d1f66c49f19ff5d62a06c5469c',
                'ac21b13204694f70b66ba9241cbb1af1',
                '5cdd70a6fb774a598dec30f739aa7532',
                '002c22a49f5b44aa833a84d5953b48fe',
                '271124eea23d48608c5eabfee5b670ae',
                '662413cf9b2e4a09b8175abf38853f1c',
            ]

            const response = await axios.post('https://api.aimlapi.com/chat/completions', {
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: query
                    }
                ],
                max_tokens: 512,
                stream: false
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + pickRandom(apiKey)
                },
                timeout: 30000
            });

            const choices = response.data.choices[0]
            const message = choices.message.content

            res.json({
                status: true,
                data: {
                    query: query,
                    response: message,
                    model: "gpt-4o",
                    tokens: response.data.usage?.total_tokens || 0
                },
                message: "GPT-4o response generated successfully"
            })

        } catch (error) {
            console.error("GPT-4o Error:", error.message)
            
            if (error.code === 'ECONNABORTED') {
                return res.status(408).json({
                    status: false,
                    error: "Request timeout",
                    message: "AI response took too long. Please try again."
                })
            }
            
            if (error.response?.status === 401) {
                return res.status(401).json({
                    status: false,
                    error: "API key error",
                    message: "All API keys are currently unavailable"
                })
            }

            res.status(500).json({
                status: false,
                error: "AI request failed",
                message: error.message || "An error occurred while generating the response"
            })
        }
    })
              }
