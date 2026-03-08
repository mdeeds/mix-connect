# Mix Connect - Design Document

## 1. System Overview
Mix Connect is a browser-based, peer-to-peer audio mixing application. It allows a user to aggregate multiple local audio input devices (microphones, interfaces), mix their levels, and stream the combined output to a connected peer via WebRTC. It also supports local monitoring of individual channels or the master mix.

**Key Constraints:**
*   **Stack:** Pure JavaScript (ES6+), HTML5, CSS3.
*   **Build:** No build steps/compilers. Statically served.
*   **Dependencies:** PeerJS (CDN) for signaling and connection management.
*   **Audio:** Web Audio API.

## 2. Architecture

The application follows a client-side MVC pattern, though simplified due to the lack of a framework.

*   **View (HTML/CSS):** Handles the DOM elements for the mixer sliders, buttons, and connection status.
*   **Controller (JS):** Manages user input, initializes the PeerJS connection, and orchestrates the Audio Context.
*   **Model (Audio Graph):** The state of the Web Audio API nodes (gains, sources, destinations).

### Data Flow
1.  **Input:** `navigator.mediaDevices.getUserMedia` captures audio.
2.  **Processing:** Web Audio API `GainNodes` control volume.
3.  **Mixing:** All inputs merge into a `MediaStreamDestination`.
4.  **Transport:** PeerJS takes the stream from the destination and transmits it to the connected peer.
5.  **Monitoring:** Specific nodes can be conditionally connected to `audioContext.destination` (local speakers).

## 3. File Structure

```text
/project-root
│
├── index.html      # Main entry point, UI structure, loads scripts
├── style.css       # All styling (Flexbox/Grid for mixer layout)
└── app.js          # Application logic (Audio handling + PeerJS)
```

## 4. Component Design

### 4.1. User Interface (`index.html` & `style.css`)
The UI consists of two main states:

1.  **Connection Panel (Overlay/Modal):**
    *   Button: "Start New Session" (Generates Peer ID).
    *   Input: "Enter Peer ID".
    *   Button: "Join Session".
2.  **Mixer Dashboard:**
    *   **Header:** Displays current Session ID and Connection Status (Waiting/Connected).
    *   **Channel Strip (Repeated per device):**
        *   Label (Device Name).
        *   Volume Slider (`<input type="range">`).
        *   Monitor Toggle (Checkbox/Button) - "Listen Locally".
    *   **Master Section:**
        *   Master Volume Slider.
        *   Master Monitor Toggle.

### 4.2. Audio Engine (`app.js`)
The core logic revolves around the `AudioContext`.

**Audio Graph Topology:**
1.  **Sources:** Created via `audioContext.createMediaStreamSource(stream)` for each device found.
2.  **Channel Gain:** Each source connects to a specific `GainNode` (controlled by UI slider).
3.  **Monitor Gate:** Each source also branches to a second `GainNode` (acting as a mute switch) connected to `audioContext.destination` for local monitoring.
4.  **Merger:** All Channel Gain nodes connect to a single `ChannelMergerNode` or simply sum into a Master Gain node.
5.  **Output:** The Master Gain connects to `audioContext.createMediaStreamDestination()`. The stream from this destination is passed to PeerJS.

### 4.3. Networking (`app.js` + PeerJS)
*   **Initialization:** `const peer = new Peer();`
*   **Host Mode:**
    *   On `peer.open`: Display ID.
    *   On `peer.call`: Answer the call and provide the mixed audio stream.
*   **Client Mode:**
    *   User inputs ID.
    *   `peer.call(remoteId, localStream)`: Initiates connection.
    *   *Note:* Even if the client is just "listening", a bi-directional call is usually established, or the client simply receives the stream.

## 5. User Flow

1.  **Load:** User opens the page.
2.  **Interaction:** User clicks "Start Session".
    *   *Action:* Browser requests microphone permissions.
    *   *Action:* App enumerates devices (`enumerateDevices`).
    *   *Action:* App initializes `AudioContext` (must be resumed on user gesture).
3.  **Setup:**
    *   App creates a mixer strip for every audio input found.
    *   PeerJS connects to the cloud server and retrieves an ID.
4.  **Connect:**
    *   **User A** copies the ID and sends it to **User B**.
    *   **User B** pastes the ID and clicks "Join".
5.  **Streaming:**
    *   Audio flows from A to B (and optionally B to A if bidirectional is desired, though requirements imply A is the mixer source).
    *   User A adjusts sliders to change the mix sent to User B.
    *   User A toggles "Monitor" on specific channels to hear them locally.