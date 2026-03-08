# Mix Connect

Mix Connect is a simple, browser-based peer-to-peer audio mixing application. It allows you to aggregate multiple local audio input devices (microphones, interfaces), mix their volume levels, and stream the combined output to a connected peer in real-time.

**Live Demo:** [https://mdeeds.github.io/mix-connect](https://mdeeds.github.io/mix-connect)

## Features

*   **Multi-Device Input:** Scans and lists all available audio input devices on your computer.
*   **Audio Mixing:** Individual volume control for each input device.
*   **Dynamic Graph:** Enable or disable specific inputs on the fly.
*   **Peer-to-Peer Streaming:** Transmits the high-quality mixed audio to a remote peer using WebRTC (via PeerJS).
*   **Zero Install:** Runs entirely in the browser with no backend logic (other than the PeerJS signaling server).

## How It Works

1.  **Start:** Click "Start" to initialize the audio engine and request microphone permissions.
2.  **Select Inputs:** The app enumerates your audio devices. Check the box next to a device to add it to the mix.
3.  **Mix:** Use the sliders to adjust the volume levels of each input.
4.  **Connect:**
    *   **Host:** Share your generated "My ID" with a friend.
    *   **Join:** Enter a friend's ID in the "Remote ID" field and click "Connect".
5.  **Listen:** The connected peer will hear the mixed audio stream.

## Tech Stack

*   **Frontend:** Pure JavaScript (ES6+), HTML5, CSS3.
*   **Audio:** Web Audio API (GainNodes, MediaStreamDestination).
*   **Networking:** PeerJS (WebRTC wrapper) for signaling and data transport.
*   **Hosting:** GitHub Pages (Static serving).

## Local Development

1.  Clone the repository.
2.  Serve the directory using a local web server (e.g., VS Code Live Server or `python -m http.server`).
    *   *Note:* Browsers often block microphone access and WebRTC on `file://` protocols, so a local server is recommended.