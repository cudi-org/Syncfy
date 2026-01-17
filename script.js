document.addEventListener('DOMContentLoaded', () => {
    // --- Mock Data ---
    const topMixes = [
        { title: "Daily Mix 1", desc: "Dua Lipa, The Weeknd, Bad Bunny...", img: "https://picsum.photos/seed/mix1/300/300", color: "#FFC212" },
        { title: "Rock Classics", desc: "Queen, AC/DC, Nirvana...", img: "https://picsum.photos/seed/rock/300/300", color: "#E91E63" },
        { title: "Coding Focus", desc: "Lofi beats to code/relax to.", img: "https://picsum.photos/seed/code/300/300", color: "#00E5FF" },
        { title: "Éxitos España", desc: "Lo más escuchado hoy.", img: "https://picsum.photos/seed/spain/300/300", color: "#F44336" },
        { title: "Discover Weekly", desc: "Tu mixtape semanal.", img: "https://picsum.photos/seed/discover/300/300", color: "#4CAF50" },
        { title: "Chill Vibes", desc: "Relájate y desconecta.", img: "https://picsum.photos/seed/chill/300/300", color: "#9C27B0" }
    ];

    const recentlyPlayed = [
        { title: "Un Verano Sin Ti", desc: "Bad Bunny", img: "https://picsum.photos/seed/badbunny/300/300" },
        { title: "Future Nostalgia", desc: "Dua Lipa", img: "https://picsum.photos/seed/dualipa/300/300" },
        { title: "After Hours", desc: "The Weeknd", img: "https://picsum.photos/seed/weeknd/300/300" },
        { title: "Motomami", desc: "Rosalía", img: "https://picsum.photos/seed/rosalia/300/300" }
    ];

    // --- State ---
    const state = {
        isPlaying: false,
        isShuffle: false,
        isRepeat: false,
        currentTrack: null,
        playlist: [], // Currently playing queue
        localTracks: [], // Tracks imported by user
        cloudTracks: [], // Tracks from Drive
        currentIndex: 0,
        volume: 0.7
    };

    // --- DOM Elements ---
    const heroGrid = document.getElementById('heroGrid');
    const madeForYou = document.getElementById('madeForYou');
    const recentlyPlayedContainer = document.getElementById('recentlyPlayed');
    const musicSections = document.querySelectorAll('.music-section');
    const heroSection = document.querySelector('.hero-section');
    const mainContent = document.querySelector('.content-scroll'); // To inject list view

    // Player DOM
    const playPauseBtn = document.getElementById('playPauseBtn');
    const playIcon = playPauseBtn.querySelector('i');
    // Ensure initial class is correct for new style
    playIcon.className = 'ph-fill ph-play';

    const progressFill = document.querySelector('.progress-fill');
    const trackNameEl = document.getElementById('trackName');
    const artistNameEl = document.getElementById('artistName');
    const currentArtEl = document.getElementById('currentArt');
    // --- Init Audio ---
    const audioPlayer = new Audio();
    audioPlayer.crossOrigin = "anonymous"; // ESTA LÍNEA ES VITAL
    audioPlayer.preload = "auto";


    // Controls DOM
    const shuffleBtn = document.querySelector('.shuffle');
    const prevBtn = document.querySelector('.prev');
    const nextBtn = document.querySelector('.next');
    const repeatBtn = document.querySelector('.repeat');
    const likeBtn = document.querySelector('.like-btn');

    // Bars
    const progressBarWrapper = document.querySelector('.progress-bar-wrapper');
    const volumeBarWrapper = document.querySelector('.volume-bar-wrapper');
    const volumeFill = document.querySelector('.volume-fill');

    // Import DOM
    const addLocalBtn = document.getElementById('addLocalBtn');
    const localFileInput = document.getElementById('localFileInput');
    const playlistList = document.getElementById('playlistList');

    // Cloud DOM
    const navCloud = document.getElementById('navCloud');
    const pinModal = document.getElementById('pinModal');
    const pinInput = document.getElementById('pinInput');
    const pinSubmitBtn = document.getElementById('pinSubmitBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const pinError = document.getElementById('pinError');


    // PWA Install
    const installBtn = document.getElementById('installBtn');
    let deferredPrompt;

    // --- Init Audio ---
    audioPlayer.volume = state.volume;
    volumeFill.style.width = `${state.volume * 100}%`;

    // --- Event Listeners ---

    // Playback Controls
    playPauseBtn.addEventListener('click', togglePlay);
    shuffleBtn.addEventListener('click', toggleShuffle);
    repeatBtn.addEventListener('click', toggleRepeat);
    likeBtn.addEventListener('click', toggleLike);

    prevBtn.addEventListener('click', playPrev);
    nextBtn.addEventListener('click', playNext);

    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', handleEnded);

    // Debugging Audio Errors
    audioPlayer.addEventListener('error', (e) => {
        const error = audioPlayer.error;
        let errorMessage = "Unknown Audio Error";
        if (error) {
            switch (error.code) {
                case error.MEDIA_ERR_ABORTED: errorMessage = "Fetch aborted by user."; break;
                case error.MEDIA_ERR_NETWORK: errorMessage = "Network error while fetching audio."; break;
                case error.MEDIA_ERR_DECODE: errorMessage = "Media decode error (corrupt or unsupported)."; break;
                case error.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMessage = "Audio format not supported or file not found (404/403)."; break;
            }
        }
        console.error(`Audio Playback Failed: ${errorMessage}`, "Src:", audioPlayer.src);
        alert(`Error al reproducir: ${errorMessage}\nComprueba la consola para más detalles.`);
    });

    // Seek (Drag & Click)
    let isDraggingProgress = false;

    progressBarWrapper.addEventListener('mousedown', (e) => {
        isDraggingProgress = true;
        seekAudio(e); // Instant jump on click
        document.addEventListener('mousemove', onProgressDrag);
        document.addEventListener('mouseup', onProgressDragEnd);
    });

    function onProgressDrag(e) {
        if (!isDraggingProgress) return;
        const rect = progressBarWrapper.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const width = rect.width;
        let percent = (offsetX / width);
        if (percent < 0) percent = 0;
        if (percent > 1) percent = 1;

        progressFill.style.width = `${percent * 100}%`;

        // Update time display while dragging
        if (audioPlayer.duration) {
            const dragTime = percent * audioPlayer.duration;
            document.querySelector('.time.current').innerText = formatTime(dragTime);
        }
    }

    function onProgressDragEnd(e) {
        if (!isDraggingProgress) return;
        // Final seek
        const rect = progressBarWrapper.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const width = rect.width;
        let percent = (offsetX / width);
        if (percent < 0) percent = 0;
        if (percent > 1) percent = 1;

        if (audioPlayer.duration) {
            audioPlayer.currentTime = percent * audioPlayer.duration;
        }

        isDraggingProgress = false;
        document.removeEventListener('mousemove', onProgressDrag);
        document.removeEventListener('mouseup', onProgressDragEnd);
    }

    // Volume (Drag & Click & Mute)
    let isDraggingVolume = false;
    let lastVolume = 0.7; // For mute toggle restore

    volumeBarWrapper.addEventListener('mousedown', (e) => {
        isDraggingVolume = true;
        setVolume(e);
        document.addEventListener('mousemove', onVolumeDrag);
        document.addEventListener('mouseup', onVolumeDragEnd);
    });

    function onVolumeDrag(e) {
        if (!isDraggingVolume) return;
        updateVolumeFromEvent(e);
    }

    function onVolumeDragEnd(e) {
        if (!isDraggingVolume) return;
        updateVolumeFromEvent(e);
        isDraggingVolume = false;
        document.removeEventListener('mousemove', onVolumeDrag);
        document.removeEventListener('mouseup', onVolumeDragEnd);
    }

    function updateVolumeFromEvent(e) {
        const rect = volumeBarWrapper.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const width = rect.width;
        let newVolume = offsetX / width;

        if (newVolume < 0) newVolume = 0;
        if (newVolume > 1) newVolume = 1;

        applyVolume(newVolume);
    }

    // Mute Toggle targeting the icon button wrapper or icon itself
    const volumeIcon = document.querySelector('.volume-wrapper i');
    if (volumeIcon) {
        volumeIcon.style.cursor = 'pointer'; // Ensure it looks clickable
        volumeIcon.addEventListener('click', toggleMute);
    }

    function toggleMute() {
        if (state.volume > 0) {
            lastVolume = state.volume;
            applyVolume(0);
        } else {
            applyVolume(lastVolume > 0 ? lastVolume : 0.5);
        }
    }

    function applyVolume(vol) {
        audioPlayer.volume = vol;
        state.volume = vol;
        volumeFill.style.width = `${vol * 100}%`;

        // Update Icon
        if (vol === 0) {
            volumeIcon.className = 'ph-fill ph-speaker-slash'; // Muted
        } else if (vol < 0.5) {
            volumeIcon.className = 'ph-fill ph-speaker-low'; // Low
        } else {
            volumeIcon.className = 'ph-fill ph-speaker-high'; // High
        }
    }

    // Import Files
    addLocalBtn.addEventListener('click', () => localFileInput.click());

    localFileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        files.forEach(file => {
            const track = {
                id: Date.now() + Math.random(),
                title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                artist: "Archivo Local",
                src: URL.createObjectURL(file), // Blob URL
                img: "icons/icon-512.png", // Default icon
                isLocal: true
            };
            state.localTracks.push(track);
        });

        // Switch to Local Playlist view immediately
        renderLocalPlaylist();
        if (typeof showNotification === 'function') {
            showNotification(`${files.length} canciones añadidas`);
        } else {
            console.log(`${files.length} canciones añadidas`);
        }
    });

    // Playlist Navigation (Simple delegation)
    playlistList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            // Remove active class from all
            document.querySelectorAll('.playlist-list li').forEach(el => el.style.color = 'var(--text-subdued)');
            e.target.style.color = 'var(--text-base)';

            if (e.target.innerText.includes('Canciones Locales')) {
                renderLocalPlaylist();
            } else {
                // Return to home/default view
                renderHome();
            }
        }
    });

    document.querySelector('.main-nav li:first-child').addEventListener('click', renderHome);

    // --- Cloud Logic ---
    const handleCloudClick = (e) => {
        e.preventDefault();
        // Visual active state Desktop
        document.querySelectorAll('.main-nav li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.playlist-list li').forEach(el => el.style.color = 'var(--text-subdued)');
        if (navCloud) navCloud.classList.add('active');

        // Visual active state Mobile
        document.querySelectorAll('.mobile-nav a').forEach(a => a.classList.remove('active'));
        const mobCloud = document.getElementById('mobileNavCloud');
        if (mobCloud) mobCloud.classList.add('active');

        if (state.cloudTracks.length > 0) {
            renderCloudPlaylist();
        } else {
            pinModal.style.display = 'flex';
            pinInput.focus();
        }
    };

    navCloud.addEventListener('click', handleCloudClick);

    const mobileNavCloud = document.getElementById('mobileNavCloud');
    if (mobileNavCloud) {
        mobileNavCloud.addEventListener('click', handleCloudClick);
    }

    const pinForm = document.getElementById('pinForm');
    pinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = pinInput.value;
        if (!pin) return;

        pinSubmitBtn.innerText = "Verificando...";
        pinError.style.display = 'none';

        try {
            const tracks = await fetchCloudMusic(pin);
            if (tracks && tracks.length > 0) {
                state.cloudTracks = tracks;
                pinModal.style.display = 'none';
                renderCloudPlaylist();
                console.log("Conectado a la Nube");
            } else {
                throw new Error("No tracks found or invalid PIN");
            }
        } catch (err) {
            console.error(err);
            pinError.style.display = 'block';
            pinSubmitBtn.innerText = "Acceder";
        }
    });

    closeModalBtn.addEventListener('click', () => {
        pinModal.style.display = 'none';
        renderHome(); // Go back home if closed
    });


    // --- Functions ---

    function renderHome() {
        // Visual updates
        document.querySelectorAll('.main-nav li').forEach(li => li.classList.remove('active'));
        document.querySelector('.main-nav li:first-child').classList.add('active');

        document.querySelectorAll('.mobile-nav a').forEach(a => a.classList.remove('active'));
        document.querySelector('.mobile-nav a:first-child').classList.add('active');

        // Show Home Sections
        heroSection.style.display = 'block';
        musicSections.forEach(el => el.style.display = 'block');

        // Remove existing list view if any
        const existingList = document.getElementById('localLinksList');
        if (existingList) existingList.remove();
    }

    function renderLocalPlaylist() {
        // Hide Home Sections
        heroSection.style.display = 'none';
        musicSections.forEach(el => el.style.display = 'none');

        // Check if list container exists
        let listContainer = document.getElementById('localLinksList');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.id = 'localLinksList';
            listContainer.className = 'local-files-container';
            mainContent.appendChild(listContainer);
        }

        if (state.localTracks.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-subdued);">
                    <i class="ph-music-notes" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
                    <h2 style="color: var(--text-base); margin-bottom: 10px;">Tu biblioteca local está vacía</h2>
                    <p>Haz clic en el icono <i class="ph-upload-simple"></i> arriba para añadir canciones.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = `
            <div class="track-list-header" style="display: grid; grid-template-columns: 50px 1fr 1fr 100px; padding: 0 16px 12px; border-bottom: 1px solid #282828; color: var(--text-subdued); font-size: 14px;">
                <span>#</span>
                <span>Título</span>
                <span>Artista</span>
                <span><i class="ph-clock"></i></span>
            </div>
            <div class="tracks-wrapper">
                ${state.localTracks.map((track, index) => `
                    <div class="track-item" onclick="playTrack(${index}, 'local')" style="display: grid; grid-template-columns: 50px 1fr 1fr 100px; padding: 12px 16px; border-radius: 4px; cursor: pointer; align-items: center; transition: background 0.2s;">
                        <span style="color: var(--text-subdued);">${index + 1}</span>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${track.img}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                            <span style="color: ${state.currentTrack === track ? 'var(--accent-color)' : 'var(--text-base)'}; font-weight: 500;">${track.title}</span>
                        </div>
                        <span style="color: var(--text-subdued);">${track.artist}</span>
                        <span style="color: var(--text-subdued);">--:--</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // --- Cloud Functions ---
    const GAS_URL = "https://script.google.com/macros/s/AKfycbyONs41LRmI-6Co8nqfP8Fb0CRmu3k9wSrep_L5n0ynWsPBOBZZTyVFe6IOxdmbOvzL/exec";
    const PROXY_URL = "https://syncfy.syncfy-api.workers.dev/?id=";

    async function fetchCloudMusic(pin) {
        try {
            const response = await fetch(`${GAS_URL}?pin=${encodeURIComponent(pin)}`);
            if (!response.ok) throw new Error("Network response was not ok");
            const data = await response.json();

            console.log("Cloud API Response:", data);

            let items = [];
            if (Array.isArray(data)) {
                items = data;
            } else if (data && data.error) {
                throw new Error(data.error);
            } else if (data && Array.isArray(data.data)) {
                items = data.data;
            } else if (data && Array.isArray(data.items)) {
                items = data.items;
            } else {
                console.error("Received data is not an array:", data);
                throw new Error("Invalid API response format");
            }

            // Map backend data to app state
            const mappedTracks = items.map((item, index) => ({
                id: item.id, // Google Drive ID needed for the worker
                title: item.title || item.nombre || "Unknown Title",
                artist: "Streaming Privado",
                src: item.url, // Keep original URL as backup/reference
                img: "https://upload.wikimedia.org/wikipedia/commons/d/da/Google_Drive_logo.png",
                isCloud: true,
                fileName: item.nombre,
                mimeType: item.tipo
            }));

            return mappedTracks;

        } catch (e) {
            console.error("Fetch Cloud Error", e);
            throw e;
        }
    }

    function renderCloudPlaylist() {
        // Hide Home Sections
        heroSection.style.display = 'none';
        musicSections.forEach(el => el.style.display = 'none');

        let listContainer = document.getElementById('localLinksList');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.id = 'localLinksList';
            listContainer.className = 'local-files-container';
            mainContent.appendChild(listContainer);
        }

        listContainer.innerHTML = `
            <div class="track-list-header" style="display: grid; grid-template-columns: 50px 1fr 1fr 100px; padding: 0 16px 12px; border-bottom: 1px solid #282828; color: var(--text-subdued); font-size: 14px;">
                <span>#</span>
                <span>Título</span>
                <span>Formato</span>
                <span><i class="ph-clock"></i></span>
            </div>
            <div class="tracks-wrapper">
                ${state.cloudTracks.map((track, index) => {
            // Extract format from mimeType (e.g., "audio/mpeg" -> "MPEG", "audio/wav" -> "WAV")
            let format = "AUDIO";
            if (track.mimeType) {
                if (track.mimeType.includes("mpeg")) format = "MP3";
                else if (track.mimeType.includes("wav")) format = "WAV";
                else if (track.mimeType.includes("ogg")) format = "OGG";
            }

            return `
                    <div class="track-item" onclick="playTrack(${index}, 'cloud')" style="display: grid; grid-template-columns: 50px 1fr 1fr 100px; padding: 12px 16px; border-radius: 4px; cursor: pointer; align-items: center; transition: background 0.2s;">
                        <span style="color: var(--text-subdued);">${index + 1}</span>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <i class="ph-fill ph-cloud-check" style="color: var(--accent-color); font-size: 24px;"></i>
                            <span style="color: ${state.currentTrack === track ? 'var(--accent-color)' : 'var(--text-base)'}; font-weight: 500;">${track.title}</span>
                        </div>
                        <span style="color: var(--text-subdued); text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">${format}</span>
                        <span style="color: var(--text-subdued);">--:--</span>
                    </div>
                `}).join('')}
            </div>
        `;
    }

    // Expose playTrack to global scope for HTML onclick
    window.playTrack = function (index, source) {
        if (source === 'local') {
            state.playlist = state.localTracks;
        } else if (source === 'cloud') {
            state.playlist = state.cloudTracks;
        }

        state.currentIndex = index;
        loadTrack(state.playlist[index]);
    };

    function loadTrack(track) {
        if (!track) return;

        state.currentTrack = track;
        audioPlayer.pause();
        audioPlayer.src = ""; // Resetear source


        if (track.isCloud) {
            // New Worker Proxy logic
            audioPlayer.src = PROXY_URL + track.id;
            // The worker handles CORS, but setting anonymous is safe
            audioPlayer.crossOrigin = "anonymous";
        } else {
            // Archivos locales (Blobs) no necesitan proxy ni CORS
            audioPlayer.removeAttribute('crossOrigin');
            audioPlayer.src = track.src;
        }

        audioPlayer.load();

        // Actualización de UI
        trackNameEl.innerText = track.title;
        artistNameEl.innerText = track.artist;
        currentArtEl.innerHTML = `<img src="${track.img}" style="width: 100%; height: 100%; object-fit: cover;">`;

        // Reset state UI
        likeBtn.classList.remove('active'); // Reset like for new song

        // Re-render list to show active color
        if (document.getElementById('localLinksList')) {
            if (track.isCloud) {
                renderCloudPlaylist();
            } else {
                renderLocalPlaylist();
            }
        }

        playAudio();
    }

    // --- Control Functions ---

    function togglePlay() {
        if (!state.currentTrack && state.localTracks.length > 0) {
            playTrack(0, 'local');
            return;
        }
        if (!state.currentTrack) return;

        if (state.isPlaying) pauseAudio();
        else playAudio();
    }

    async function playAudio() {
        if (!audioPlayer.src) return;

        try {
            const playPromise = audioPlayer.play();
            if (playPromise !== undefined) {
                await playPromise;
                state.isPlaying = true;
                playIcon.className = 'ph-fill ph-pause';
                currentArtEl.classList.add('playing');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log("Reproducción interrumpida (normal al cambiar rápido de canción)");
            } else {
                console.error("Error real al reproducir:", error);
            }
        }
    }

    function pauseAudio() {
        audioPlayer.pause();
        state.isPlaying = false;
        playIcon.className = 'ph-fill ph-play'; // Explicitly set the play icon
        currentArtEl.classList.remove('playing');
    }

    function toggleShuffle() {
        state.isShuffle = !state.isShuffle;
        shuffleBtn.classList.toggle('active', state.isShuffle);
    }

    function toggleRepeat() {
        state.isRepeat = !state.isRepeat;
        repeatBtn.classList.toggle('active', state.isRepeat);
    }

    function toggleLike() {
        likeBtn.classList.toggle('active');
        // Logic to save to favorites would go here
    }

    function playNext() {
        if (state.playlist.length === 0) return;

        if (state.isShuffle) {
            // Random index
            state.currentIndex = Math.floor(Math.random() * state.playlist.length);
        } else {
            state.currentIndex = (state.currentIndex + 1) % state.playlist.length;
        }

        loadTrack(state.playlist[state.currentIndex]);
    }

    function playPrev() {
        if (state.playlist.length === 0) return;

        // If playing > 3s, restart track like Spotify
        if (audioPlayer.currentTime > 3) {
            audioPlayer.currentTime = 0;
            return;
        }

        state.currentIndex = (state.currentIndex - 1 + state.playlist.length) % state.playlist.length;
        loadTrack(state.playlist[state.currentIndex]);
    }

    function handleEnded() {
        if (state.isRepeat) {
            audioPlayer.currentTime = 0;
            playAudio();
        } else {
            playNext();
        }
    }

    function seekAudio(e) {
        if (!audioPlayer.duration) return;
        const width = progressBarWrapper.clientWidth;
        const clickX = e.offsetX;
        const duration = audioPlayer.duration;

        audioPlayer.currentTime = (clickX / width) * duration;
    }

    function setVolume(e) {
        updateVolumeFromEvent(e);
    }

    function updateProgress() {
        // Don't update visual progress bar if user is dragging it
        if (isDraggingProgress) return;
        if (isNaN(audioPlayer.duration)) return;

        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = `${percent}%`;

        document.querySelector('.time.current').innerText = formatTime(audioPlayer.currentTime);
        document.querySelector('.time.total').innerText = formatTime(audioPlayer.duration);
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // PWA Install Logic
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBtn.classList.remove('hidden');
    });

    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                installBtn.classList.add('hidden');
            }
            deferredPrompt = null;
        }
    });

    // --- Render Initial Home ---
    function renderHero() {
        heroGrid.innerHTML = topMixes.map(item => `
            <div class="hero-card">
                <img src="${item.img}" class="hero-img" alt="${item.title}">
                <div class="hero-title">${item.title}</div>
            </div>
        `).join('');
    }

    function renderCards(apiData, container, showPlay = true) {
        container.innerHTML = apiData.map(item => `
            <div class="music-card">
                <div class="card-img-wrapper">
                    <img src="${item.img}" class="card-img" alt="${item.title}">
                    ${showPlay ? `<div class="play-btn-overlay"><i class="ph-fill ph-play"></i></div>` : ''}
                </div>
                <div class="card-title">${item.title}</div>
                <div class="card-desc">${item.desc}</div>
            </div>
        `).join('');
    }

    renderHero();
    renderCards(topMixes, madeForYou);
    renderCards(recentlyPlayed, recentlyPlayedContainer);

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch((err) => console.log('SW Failed', err));
    }
});
