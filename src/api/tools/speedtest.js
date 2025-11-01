import axios from 'axios'

export default function speedTestRoute(app) {
    app.get("/tools/speedtest", async (req, res) => {
        try {
            const startTime = performance.now()
            let uploadSpeed = 0
            let downloadSpeed = 0
            let ping = 0
            let networkInfo = { location: 'N/A', org: 'N/A', ip: 'N/A' }

            // Ping test
            try {
                const start = performance.now()
                await axios.get('https://www.google.com', { timeout: 10000 })
                ping = Math.round(performance.now() - start)
            } catch {
                ping = 0
            }

            // Upload test
            try {
                const url = 'https://speed.cloudflare.com/__up'
                const data = '0'.repeat(5 * 1024 * 1024) // 5MB test data
                const response = await axios.post(url, data, {
                    headers: { 'Content-Length': data.length },
                    timeout: 30000
                })
                const duration = (performance.now() - startTime) / 1000
                if (response.status === 200) {
                    uploadSpeed = data.length / (duration || 1)
                }
            } catch (e) {
                throw new Error(`Upload test failed: ${e.message}`)
            }

            // Download test
            try {
                const downloadStart = performance.now()
                const response = await axios.get('https://speed.cloudflare.com/__down', {
                    timeout: 30000,
                    responseType: 'arraybuffer'
                })
                const downloadDuration = (performance.now() - downloadStart) / 1000
                if (response.status === 200) {
                    downloadSpeed = response.data.length / (downloadDuration || 1)
                }
            } catch (e) {
                // Download test is optional, don't throw error
                console.error("Download test failed:", e.message)
            }

            // Network info
            try {
                const response = await axios.get('https://ipinfo.io/json', { timeout: 10000 })
                if (response.status === 200) {
                    const data = response.data
                    networkInfo = {
                        location: `${data.city || 'N/A'}, ${data.country || 'N/A'}`,
                        org: (data.org || 'N/A').replace('AS', ''),
                        ip: data.ip || 'N/A',
                        country: data.country || 'N/A',
                        city: data.city || 'N/A'
                    }
                }
            } catch {
                networkInfo = { location: 'N/A', org: 'N/A', ip: 'N/A', country: 'N/A', city: 'N/A' }
            }

            const formatSpeed = (bytesPerSec) => {
                if (bytesPerSec <= 0) return '0 Mbps'
                const mbits = (bytesPerSec * 8) / (1024 * 1024)
                return mbits >= 1 ? `${mbits.toFixed(2)} Mbps` : `${(mbits * 1000).toFixed(2)} Kbps`
            }

            const formatBytes = (bytes) => {
                if (bytes <= 0) return '0 B'
                const sizes = ['B', 'KB', 'MB', 'GB']
                const i = Math.floor(Math.log(bytes) / Math.log(1024))
                return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
            }

            const result = {
                upload: formatSpeed(uploadSpeed),
                download: formatSpeed(downloadSpeed),
                ping: `${ping} ms`,
                server: networkInfo.location,
                provider: networkInfo.org,
                ip: networkInfo.ip,
                country: networkInfo.country,
                city: networkInfo.city,
                duration: `${((performance.now() - startTime) / 1000).toFixed(2)} seconds`,
                timestamp: new Date().toISOString(),
                raw: {
                    uploadBytesPerSec: uploadSpeed,
                    downloadBytesPerSec: downloadSpeed,
                    pingMs: ping
                }
            }

            res.json({
                status: true,
                data: result,
                message: "Speed test completed successfully"
            })

        } catch (error) {
            console.error("SpeedTest Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Speed test failed",
                message: error.message || "An error occurred during speed test"
            })
        }
    })
}