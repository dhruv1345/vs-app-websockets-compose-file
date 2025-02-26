const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const ws = new WebSocket("ws://" + window.location.hostname + ":8000/ws");

let localStream;
let peerConnection;

async function startCall() {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;

    peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }] // STUN server for NAT traversal
    });

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            ws.send(JSON.stringify({ candidate: event.candidate }));
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    ws.send(JSON.stringify({ offer }));
}

ws.onmessage = async event => {
    const data = JSON.parse(event.data);

    if (!peerConnection) {
        peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
        });

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = event => remoteVideo.srcObject = event.streams[0];
        peerConnection.onicecandidate = event => {
            if (event.candidate) ws.send(JSON.stringify({ candidate: event.candidate }));
        };
    }

    if (data.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        ws.send(JSON.stringify({ answer }));
    } else if (data.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
};

// Handle WebSocket disconnection & reconnect
ws.onclose = () => {
    console.log("WebSocket disconnected, reconnecting...");
    setTimeout(() => {
        window.location.reload();
    }, 3000);
};
