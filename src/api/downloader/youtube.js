const yt = {
    get url() {
        return {
            origin: 'https://ytmp3.cx'
        }
    },

    get baseHeaders() {
        return {
            'accept-encoding': 'gzip, deflate, br, zstd',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    },

    extractVideoId: function (fV) {
        let v
        if (fV.indexOf('youtu.be') > -1) {
            v = /\/([a-zA-Z0-9\-\_]{11})/.exec(fV)
        } else if (fV.indexOf('youtube.com') > -1) {
            if (fV.indexOf('/shorts/') > -1) {
                v = /\/([a-zA-Z0-9\-\_]{11})/.exec(fV)
            } else {
                v = /v\=([a-zA-Z0-9\-\_]{11})/.exec(fV)
            }
        }
        const result = v?.[1]
        if (!result) throw Error(`Failed to extract video ID`)
        return result
    },

    getInitUrl: async function () {
        try {
            const r1 = await fetch(this.url.origin, { headers: this.baseHeaders })
            const html = await r1.text()
            const jsPath = html.match(/<script src="(.+?)"/)?.[1]
            const jsUrl = this.url.origin + jsPath
            const r2 = await fetch(jsUrl, { headers: this.baseHeaders })
            const js = await r2.text()

            const gB_m = js.match(/gB=(.+?),gD/)?.[1]
            const gB = eval(gB_m)

            const html_m = html.match(/<script>(.+?)<\/script>/)?.[1]
            const hiddenGc = eval(html_m + "gC")
            const gC = Object.fromEntries(Object.getOwnPropertyNames(hiddenGc).map(key => [key, hiddenGc[key]]))

            const decodeBin = (d) => d.split(' ').map(v => parseInt(v, 2))
            const decodeHex = (d) => d.match(/0x[a-fA-F0-9]{2}/g).map(v => String.fromCharCode(v)).join("")
            const getTimestamp = () => Math.floor((new Date).getTime() / 1e3)

            function authorization() {
                var dec = decodeBin(gC.d(1)[0])
                var k = ''
                for (var i = 0; i < dec.length; i++) k += (gC.d(2)[0] > 0) ? atob(gC.d(1)[1]).split('').reverse().join('')[(dec[i] - gC.d(2)[1])] : atob(gC.d(1)[1])[(dec[i] - gC.d(2)[1])]
                if (gC.d(2)[2] > 0) k = k.substring(0, gC.d(2)[2])
                switch (gC.d(2)[3]) {
                    case 0:
                        return btoa(k + '_' + decodeHex(gC.d(3)[0]))
                    case 1:
                        return btoa(k.toLowerCase() + '_' + decodeHex(gC.d(3)[0]))
                    case 2:
                        return btoa(k.toUpperCase() + '_' + decodeHex(gC.d(3)[0]))
                }
            }

            const api_m = js.matchAll(/};var \S{1}=(.+?);gR&&\(/g)
            const e = Array.from(api_m)?.[1]?.[1]
            const apiUrl = eval(`${e}`)
            return apiUrl
        } catch (e) {
            throw new Error('Failed to get API URL')
        }
    },

    download: async function (url, f = 'mp3') {
        if (!/^mp3|mp4$/.test(f)) throw Error(`Format must be mp3 or mp4`)
        const v = this.extractVideoId(url)
        const headers = {
            'referer': this.url.origin,
            ...this.baseHeaders
        }
        const initApi = await this.getInitUrl()
        const r1 = await fetch(initApi, { headers })
        const j1 = await r1.json()
        const { convertURL } = j1
        const convertApi = convertURL + '&v=' + v + '&f=' + f + '&_=' + Math.random()
        const r2 = await fetch(convertApi, { headers })
        const j2 = await r2.json()
        if (j2.error) throw Error(`Error in conversion: ${JSON.stringify(j2, null, 2)}`)
        if (j2.redirectURL) {
            const r3 = await fetch(j2.redirectURL, { headers })
            const j3 = await r3.json()
            const result = {
                title: j3.title,
                downloadURL: j3.downloadURL,
                format: f,
                videoId: v
            }
            return result
        } else {
            let j3b
            let attempts = 0
            const maxAttempts = 10
            
            do {
                const r3b = await fetch(j2.progressURL, { headers })
                j3b = await r3b.json()
                if (j3b.error) throw Error(`Error checking progress: ${JSON.stringify(j3b, null, 2)}`)
                if (j3b.progress == 3) {
                    const result = {
                        title: j3b.title,
                        downloadURL: j2.downloadURL,
                        format: f,
                        videoId: v
                    }
                    return result
                }
                attempts++
                await new Promise(resolve => setTimeout(resolve, 3000))
            } while (attempts < maxAttempts)
            
            throw Error('Conversion timeout - please try again')
        }
    }
}

export default function youtubeDownloaderRoute(app) {
    // MP3 Download Endpoint
    app.get("/downloader/youtube/audio", async (req, res) => {
        try {
            const { url } = req.query
            
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: "URL parameter is required",
                    message: "Please provide a YouTube URL"
                })
            }

            // Validate YouTube URL
            const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9\-\_]{11})/
            if (!youtubeRegex.test(url)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid YouTube URL",
                    message: "Please provide a valid YouTube URL"
                })
            }

            const result = await yt.download(url, 'mp3')
            
            res.json({
                status: true,
                data: {
                    title: result.title,
                    downloadUrl: result.downloadURL,
                    format: result.format,
                    videoId: result.videoId,
                    type: "audio"
                },
                message: "Successfully converted YouTube video to MP3"
            })

        } catch (error) {
            console.error("YouTube MP3 Download Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "MP3 conversion failed",
                message: error.message || "An error occurred while converting to MP3"
            })
        }
    })

    // MP4 Download Endpoint
    app.get("/downloader/youtube/video", async (req, res) => {
        try {
            const { url } = req.query
            
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: "URL parameter is required",
                    message: "Please provide a YouTube URL"
                })
            }

            // Validate YouTube URL
            const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9\-\_]{11})/
            if (!youtubeRegex.test(url)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid YouTube URL",
                    message: "Please provide a valid YouTube URL"
                })
            }

            const result = await yt.download(url, 'mp4')
            
            res.json({
                status: true,
                data: {
                    title: result.title,
                    downloadUrl: result.downloadURL,
                    format: result.format,
                    videoId: result.videoId,
                    type: "video"
                },
                message: "Successfully downloaded YouTube video as MP4"
            })

        } catch (error) {
            console.error("YouTube MP4 Download Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "MP4 download failed",
                message: error.message || "An error occurred while downloading MP4"
            })
        }
    })

    // Combined endpoint with format parameter
    app.get("/downloader/youtube", async (req, res) => {
        try {
            const { url, format = "mp4" } = req.query
            
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: "URL parameter is required",
                    message: "Please provide a YouTube URL"
                })
            }

            if (!["mp3", "mp4"].includes(format)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid format",
                    message: "Format must be mp3 or mp4"
                })
            }

            // Validate YouTube URL
            const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9\-\_]{11})/
            if (!youtubeRegex.test(url)) {
                return res.status(400).json({
                    status: false,
                    error: "Invalid YouTube URL",
                    message: "Please provide a valid YouTube URL"
                })
            }

            const result = await yt.download(url, format)
            
            res.json({
                status: true,
                data: {
                    title: result.title,
                    downloadUrl: result.downloadURL,
                    format: result.format,
                    videoId: result.videoId,
                    type: format === "mp3" ? "audio" : "video"
                },
                message: `Successfully processed YouTube video as ${format.toUpperCase()}`
            })

        } catch (error) {
            console.error("YouTube Download Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Download failed",
                message: error.message || "An error occurred while processing the video"
            })
        }
    })
}