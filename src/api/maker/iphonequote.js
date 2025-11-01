import axios from 'axios'

export default function iphoneQuoteRoute(app) {
    app.get("/maker/iphonequote", async (req, res) => {
        try {
            const { time, battery, message, carrier = "INDOSAT OREEDOO", emoji = "apple" } = req.query
            
            if (!time || !battery || !message) {
                return res.status(400).json({
                    status: false,
                    error: "Missing parameters",
                    message: "Please provide time, battery, and message parameters"
                })
            }

            const url = `https://brat.siputzx.my.id/iphone-quoted?time=${encodeURIComponent(time)}&batteryPercentage=${battery}&carrierName=${encodeURIComponent(carrier)}&messageText=${encodeURIComponent(message)}&emojiStyle=${emoji}`

            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })

            const base64Image = Buffer.from(response.data).toString('base64')
            const dataUrl = `data:image/png;base64,${base64Image}`

            res.json({
                status: true,
                data: {
                    image: dataUrl,
                    format: "png",
                    parameters: {
                        time,
                        battery,
                        message,
                        carrier,
                        emojiStyle: emoji
                    }
                },
                message: "iPhone quote created successfully"
            })

        } catch (error) {
            console.error("iPhone Quote Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Quote creation failed",
                message: error.message || "An error occurred while creating the iPhone quote"
            })
        }
    })
}