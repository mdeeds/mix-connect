const startBtn = document.getElementById('start-btn');
const deviceList = document.getElementById('device-list');

let audioCtx;
let masterGain;
let localStreamDest;
let peer;
const activeSources = {}; // Map deviceId -> { stream, source, gain }

startBtn.addEventListener('click', async () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();

        // Create destination for the mix to be sent over PeerJS
        localStreamDest = audioCtx.createMediaStreamDestination();
        masterGain.connect(localStreamDest);
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }

    // Request permission to access devices and get labels
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately
        enumerateDevices();
        startBtn.disabled = true;
        startBtn.textContent = "Scanning...";
        initPeer();
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Microphone access is required to list devices.');
    }
});

async function enumerateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    deviceList.innerHTML = '';
    startBtn.textContent = "Devices Found";

    audioInputs.forEach(device => {
        createDeviceStrip(device);
    });
}

function createDeviceStrip(device) {
    const div = document.createElement('div');
    div.className = 'device-strip';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `cb-${device.deviceId}`;
    checkbox.addEventListener('change', (e) => toggleDevice(device.deviceId, e.target.checked));

    const label = document.createElement('label');
    label.htmlFor = `cb-${device.deviceId}`;
    label.textContent = device.label || `Microphone ${device.deviceId.slice(0, 5)}...`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 0;
    slider.max = 100;
    slider.value = 100;
    slider.id = `slider-${device.deviceId}`;
    slider.addEventListener('input', (e) => updateVolume(device.deviceId, e.target.value));

    const controls = document.createElement('div');
    controls.className = 'device-controls';
    controls.appendChild(label);
    controls.appendChild(slider);

    div.appendChild(checkbox);
    div.appendChild(controls);
    deviceList.appendChild(div);
}

async function toggleDevice(deviceId, isChecked) {
    if (isChecked) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { deviceId: { exact: deviceId } }
            });

            const source = audioCtx.createMediaStreamSource(stream);
            const gain = audioCtx.createGain();

            const slider = document.getElementById(`slider-${deviceId}`);
            gain.gain.value = slider ? slider.value / 100 : 1;

            source.connect(gain);
            gain.connect(masterGain);

            activeSources[deviceId] = { stream, source, gain };
        } catch (err) {
            console.error(`Error activating device ${deviceId}:`, err);
            const cb = document.getElementById(`cb-${deviceId}`);
            if (cb) cb.checked = false;
            alert(`Could not access device: ${deviceId}`);
        }
    } else {
        const active = activeSources[deviceId];
        if (active) {
            active.source.disconnect();
            active.gain.disconnect();
            active.stream.getTracks().forEach(track => track.stop());
            delete activeSources[deviceId];
        }
    }
}

function updateVolume(deviceId, value) {
    const active = activeSources[deviceId];
    if (active) {
        active.gain.gain.value = value / 100;
    }
}

function initPeer() {
    peer = new Peer();

    peer.on('open', (id) => {
        document.getElementById('connection-panel').classList.remove('hidden');
        document.getElementById('my-id').textContent = id;
    });

    peer.on('call', (call) => {
        // Answer incoming call with our mixed stream
        call.answer(localStreamDest.stream);
        handleCall(call);
    });

    peer.on('error', (err) => {
        console.error('PeerJS error:', err);
        document.getElementById('status').textContent = 'Error: ' + err.type;
    });
}

document.getElementById('connect-btn').addEventListener('click', () => {
    const remoteId = document.getElementById('remote-id').value;
    if (remoteId) {
        const call = peer.call(remoteId, localStreamDest.stream);
        handleCall(call);
    }
});

function handleCall(call) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = "Connecting...";

    call.on('stream', (remoteStream) => {
        statusDiv.textContent = "Connected";
        // Play the remote stream through Web Audio API
        const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
        remoteSource.connect(audioCtx.destination);
    });
}