const startBtn = document.getElementById('start-btn');
const deviceList = document.getElementById('device-list');

let audioCtx;
let masterGain;
let localStreamDest;
let peer;
let volumeNode;
const activeSources = {}; // Map deviceId -> { stream, source, gain }

startBtn.addEventListener('click', async () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();

    volumeNode = audioCtx.createGain();
    volumeNode.connect(audioCtx.destination);
    createMasterControls();

    // Create destination for the mix to be sent over PeerJS
    localStreamDest = audioCtx.createMediaStreamDestination();
    masterGain.connect(localStreamDest);
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }

  // Request permission to access devices and get labels
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });
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
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
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

function generateId() {
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  let id = '';
  for (let i = 0; i < 3; i++) {
    id += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  id += '-';
  for (let i = 0; i < 4; i++) {
    id += Math.floor(Math.random() * 10);
  }
  return id;
}

function startHostSession(id) {
  peer = new Peer(id);

  peer.on('open', (id) => {
    console.log('peer.on("open") Opening connection to peer.');
    document.getElementById('connection-panel').classList.remove('hidden');
    document.getElementById('my-id').textContent = id;

    const url = new URL(window.location);
    url.searchParams.set('id', id);
    window.history.replaceState({}, '', url);
  });

  peer.on('call', (call) => {
    console.log('peer.on("call") Answering call...');
    call.answer(localStreamDest.stream);
    handleCall(call);
  });

  peer.on('error', (err) => {
    console.error('PeerJS error:', err);
    document.getElementById('status').textContent = 'Error: ' + err.type;
    if (err.type === 'unavailable-id') {
      peer.destroy();
      startHostSession(generateId());
    }
  });
}

function initPeer() {
  const urlParams = new URLSearchParams(window.location.search);
  let targetId = urlParams.get('id');

  if (!targetId && window.location.search.length > 1) {
    const raw = window.location.search.substring(1);
    if (/^[a-z]{3}-\d{4}$/.test(raw)) {
      targetId = raw;
    }
  }

  if (targetId) {
    peer = new Peer();

    peer.on('open', (id) => {
      console.log('Client initialized. Connecting to:', targetId);
      document.getElementById('connection-panel').classList.remove('hidden');
      document.getElementById('my-id').textContent = id;
      document.getElementById('remote-id').value = targetId;

      const call = peer.call(targetId, localStreamDest.stream);
      handleCall(call);
    });

    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        console.log('Target ID not found. Starting session as host:', targetId);
        peer.destroy();
        startHostSession(targetId);
      } else {
        console.error('PeerJS error:', err);
        document.getElementById('status').textContent = 'Error: ' + err.type;
      }
    });

    peer.on('call', (call) => {
      call.answer(localStreamDest.stream);
      handleCall(call);
    });
  } else {
    startHostSession(generateId());
  }
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
    console.log('call.on("stream") Received remote stream.');
    statusDiv.textContent = "Connected";
    // Play the remote stream through Web Audio API
    const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
    remoteSource.connect(volumeNode);

    // Ungodly hack to actually get the audio to flow
    const a = new Audio();
    a.muted = true;
    a.srcObject = remoteStream;
    a.addEventListener('canplaythrough', () => { console.log('ready to flow'); });
    // End ungodly hack.
  });
}

function createMasterControls() {
  const container = document.createElement('div');
  container.style.marginTop = '20px';
  container.style.padding = '10px';
  container.style.borderTop = '1px solid #ccc';

  const label = document.createElement('label');
  label.textContent = 'Master Volume: ';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = 0;
  slider.max = 100;
  slider.value = 100;
  slider.addEventListener('input', (e) => {
    if (volumeNode) volumeNode.gain.value = e.target.value / 100;
  });

  const toneBtn = document.createElement('button');
  toneBtn.textContent = 'Test Tone (440Hz)';
  toneBtn.style.marginLeft = '15px';
  toneBtn.addEventListener('click', () => {
    const osc = audioCtx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(volumeNode);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
    osc.onended = () => osc.disconnect();
  });

  const sendToneBtn = document.createElement('button');
  sendToneBtn.textContent = 'Send test tone';
  sendToneBtn.style.marginLeft = '15px';
  sendToneBtn.addEventListener('click', () => {
    console.log('Sending tone...');
    const osc = audioCtx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
    osc.onended = () => osc.disconnect();
  });

  container.append(label, slider, toneBtn, sendToneBtn);
  document.body.appendChild(container);
}