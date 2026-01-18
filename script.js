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
        playlist: [], // Currently playing queue (context)
        queue: [], // User added manual queue
        localTracks: [],
        cloudTracks: [],
        playlists: [], // Array of {id, name, tracks: []}
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
    audioPlayer.preload = "auto";
    audioPlayer.crossOrigin = "anonymous";


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
    audioPlayer.addEventListener('loadedmetadata', () => {
        const totalS = Math.floor(audioPlayer.duration);
        const min = Math.floor(totalS / 60);
        const seg = (totalS % 60).toString().padStart(2, '0');
        document.querySelector('.time.total').innerText = `${min}:${seg}`;
    });

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

    localFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const processTrack = (file) => {
            return new Promise((resolve) => {
                const baseTrack = {
                    id: Date.now() + Math.random(),
                    title: file.name.replace(/\.[^/.]+$/, ""), // Fallback title
                    artist: "Archivo Local",
                    src: URL.createObjectURL(file),
                    img: "icons/icon-512.png",
                    isLocal: true
                };

                if (window.jsmediatags) {
                    window.jsmediatags.read(file, {
                        onSuccess: function (tag) {
                            const tags = tag.tags;
                            let imageSrc = baseTrack.img;

                            if (tags.picture) {
                                try {
                                    const { data, format } = tags.picture;
                                    const byteArray = new Uint8Array(data);
                                    const blob = new Blob([byteArray], { type: format });
                                    imageSrc = URL.createObjectURL(blob);
                                } catch (err) {
                                    console.error("Error procesando imagen local", err);
                                }
                            }

                            resolve({
                                ...baseTrack,
                                title: tags.title || baseTrack.title,
                                artist: tags.artist || baseTrack.artist,
                                img: imageSrc
                            });
                        },
                        onError: function (error) {
                            console.log("JSMediaTags Error:", error);
                            resolve(baseTrack);
                        }
                    });
                } else {
                    resolve(baseTrack);
                }
            });
        };

        // Procesar todos los archivos seleccionados
        const newTracks = await Promise.all(files.map(processTrack));
        state.localTracks.push(...newTracks);

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
                // Deprecated: Now we use Library
                renderLibrary();
            } else if (e.target.dataset.playlistId) {
                renderPlaylist(e.target.dataset.playlistId);
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

                // Refresh Library view if active, else might stay on home
                renderLibrary();
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

    // --- Unified Library Logic ---
    function renderLibrary() {
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

        // Combine tracks
        const allTracks = [...state.localTracks, ...state.cloudTracks];

        if (allTracks.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-subdued);">
                    <i class="ph-music-notes" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
                    <h2 style="color: var(--text-base); margin-bottom: 10px;">Tu biblioteca está vacía</h2>
                    <p>Importa canciones locales o conéctate a la nube.</p>
                </div>
            `;
            return;
        }

        renderTrackList(allTracks, listContainer, 'library');
    }

    function renderPlaylist(playlistId) {
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

        const playlist = state.playlists.find(p => p.id == playlistId);
        if (!playlist) return;

        if (playlist.tracks.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: var(--text-subdued);">
                    <h2 style="color: var(--text-base); margin-bottom: 10px;">Playlist vacía</h2>
                    <p>Añade canciones desde el menú de opciones (...)</p>
                </div>
            `;
            return;
        }

        renderTrackList(playlist.tracks, listContainer, 'playlist', playlistId);
    }

    function renderTrackList(tracks, container, source, playlistId = null) {
        container.innerHTML = `
            <div class="track-list-header" style="display: grid; grid-template-columns: 40px 1fr 1fr 40px; padding: 0 16px 12px; border-bottom: 1px solid #282828; color: var(--text-subdued); font-size: 14px;">
                <span>#</span>
                <span>Título</span>
                <span>Artista</span>
                <span></span>
            </div>
            <div class="tracks-wrapper">
                ${tracks.map((track, index) => `
                    <div class="track-item" onclick="playTrack(${index}, '${source}', '${playlistId || ''}')" style="display: grid; grid-template-columns: 40px 1fr 1fr 40px; padding: 12px 16px; border-radius: 4px; cursor: pointer; align-items: center; transition: background 0.2s;">
                        <span style="color: var(--text-subdued);">${index + 1}</span>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <img src="${track.img}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">
                            <div style="overflow: hidden;">
                                <span style="display:block; color: ${state.currentTrack === track ? 'var(--accent-color)' : 'var(--text-base)'}; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${track.title}</span>
                            </div>
                        </div>
                        <span style="color: var(--text-subdued); white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${track.artist}</span>
                        <button class="extra-btn" onclick="openContextMenu(event, ${index}, '${source}', '${playlistId || ''}')" style="font-size: 20px;"><i class="ph-bold ph-dots-three"></i></button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Deprecating separated renderLocalPlaylist and CloudPlaylist in favor of Unified Library
    // But keeping empty functions if called elsewhere or removing them if possible. 
    function renderLocalPlaylist() { renderLibrary(); }
    function renderCloudPlaylist() { renderLibrary(); }

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
    // Expose playTrack to global scope for HTML onclick
    // Expose playTrack to global scope for HTML onclick
    window.playTrack = function (index, source, playlistId = null) {
        console.log(`User clicked track ${index} from ${source}`);
        if (event.target.closest('.extra-btn')) return; // Prevent click if clicking the dots

        let targetPlaylist = [];
        if (source === 'library') {
            targetPlaylist = [...state.localTracks, ...state.cloudTracks];
        } else if (source === 'playlist' && playlistId) {
            const pl = state.playlists.find(p => p.id == playlistId);
            if (pl) targetPlaylist = pl.tracks;
        } else if (source === 'local') {
            targetPlaylist = state.localTracks;
        } else if (source === 'cloud') {
            targetPlaylist = state.cloudTracks;
        }

        // If clicking the currently playing track, just toggle play/pause
        if (state.currentTrack && state.currentTrack === targetPlaylist[index]) {
            togglePlay();
            return;
        }

        // Otherwise, load new context and track
        state.playlist = targetPlaylist;
        state.currentIndex = index;
        loadTrack(state.playlist[index]);
    };

    // --- Context Menu Logic ---
    let ctxTrack = null;
    const contextMenu = document.getElementById('contextMenu');

    window.openContextMenu = function (e, index, source, playlistId) {
        e.stopPropagation();
        e.preventDefault();

        // Find track
        let list = [];
        if (source === 'library') list = [...state.localTracks, ...state.cloudTracks];
        else if (source === 'playlist') list = state.playlists.find(p => p.id == playlistId).tracks;

        ctxTrack = list[index];

        // Position menu
        contextMenu.style.display = 'block';
        contextMenu.style.left = `${e.pageX - 160}px`;
        contextMenu.style.top = `${e.pageY}px`;

        // Close on outside click
        document.addEventListener('click', closeContextMenu, { once: true });
    };

    function closeContextMenu() {
        contextMenu.style.display = 'none';
        ctxTrack = null;
    }

    document.getElementById('ctxQueue').addEventListener('click', () => {
        if (ctxTrack) {
            state.queue.push(ctxTrack);
            console.log("Added to queue", ctxTrack.title);
            // Optionally show toast
        }
    });

    // --- Playlist Creation Logic ---
    const playlistModal = document.getElementById('playlistModal');
    const createPlaylistConfirmBtn = document.getElementById('createPlaylistConfirmBtn');
    const newPlaylistName = document.getElementById('newPlaylistName');
    const closePlaylistModalBtn = document.getElementById('closePlaylistModalBtn');

    // Wire up "New Playlist" button (assuming one exists or reused addLocalBtn logic if needed)
    // IMPORTANT: Check if we have a button for creating playlists specifically. 
    // The user has a sidebar section for playlists. Let's make the "+" button generic or add a new one. 
    // Reusing the header button .add-playlist for Importing, maybe add a new UI element? 
    // For now, let's assume we add a "Crear Playlist" text button at bottom of sidebar or use context menu there.

    // Let's attach to the 'add-playlist' button but ask user: Local Files or New Playlist?
    // or simplicity: Just create a function exposed globally
    window.openCreatePlaylistModal = function () {
        playlistModal.style.display = 'flex';
        newPlaylistName.focus();
    };

    createPlaylistConfirmBtn.addEventListener('click', () => {
        const name = newPlaylistName.value.trim();
        if (name) {
            const newPl = { id: Date.now(), name: name, tracks: [] };
            state.playlists.push(newPl);
            renderSidebarPlaylists();
            playlistModal.style.display = 'none';
            newPlaylistName.value = "";
        }
    });

    closePlaylistModalBtn.addEventListener('click', () => playlistModal.style.display = 'none');

    function renderSidebarPlaylists() {
        const container = document.getElementById('playlistList');
        // Keep static items (Local, Favs...) and append dynamic ones.
        // Actually, simpler to just rebuild.
        // Let's keep "Canciones Locales" as hardcoded in HTML, and append dynamic LI elements.

        // Remove old dynamic ones
        const oldDynamic = container.querySelectorAll('.dynamic-pl');
        oldDynamic.forEach(el => el.remove());

        state.playlists.forEach(pl => {
            const li = document.createElement('li');
            li.className = 'dynamic-pl';
            li.innerText = pl.name;
            li.dataset.playlistId = pl.id;
            container.appendChild(li);
        });
    }

    // Add to Playlist Modal
    const addToPlaylistModal = document.getElementById('addToPlaylistModal');
    const addToPlaylistList = document.getElementById('addToPlaylistList');
    const closeAddToPlaylistModalBtn = document.getElementById('closeAddToPlaylistModalBtn');

    document.getElementById('ctxAddToPlaylist').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!ctxTrack) return;

        addToPlaylistList.innerHTML = '';
        state.playlists.forEach(pl => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="ph-bold ph-music-notes-simple"></i> ${pl.name}`;
            li.onclick = () => {
                pl.tracks.push(ctxTrack);
                addToPlaylistModal.style.display = 'none';
                console.log(`Added ${ctxTrack.title} to ${pl.name}`);
            };
            addToPlaylistList.appendChild(li);
        });

        addToPlaylistModal.style.display = 'flex';
    });

    closeAddToPlaylistModalBtn.addEventListener('click', () => addToPlaylistModal.style.display = 'none');


    // Update Library Link click handler
    document.querySelector('.main-nav li:nth-child(3) a').addEventListener('click', (e) => {
        e.preventDefault();
        // Update styling
        document.querySelectorAll('.main-nav li').forEach(li => li.classList.remove('active'));
        e.target.closest('li').classList.add('active');
        renderLibrary();
    });

    // Add logic to mobile library button too
    const mobLib = document.querySelector('.mobile-nav a:nth-child(3)');
    if (mobLib) {
        mobLib.addEventListener('click', (e) => {
            e.preventDefault();
            renderLibrary();
        });
    }

    function loadTrack(track) {
        if (!track) return;

        state.currentTrack = track;
        audioPlayer.pause();
        audioPlayer.src = "";
        audioPlayer.load(); // Esto libera el ancho de banda que estuviera usando la canción vieja


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
        // Actualización de UI
        currentArtEl.innerHTML = `<img src="${track.img}" style="width: 100%; height: 100%; object-fit: cover;">`;

        const cacheKey = `meta_${track.id}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
            // Si ya la conocemos, actualizamos la interfaz al instante
            aplicarMetadatos(JSON.parse(cachedData));
        } else {
            // Si es nueva, ponemos datos por defecto y empezamos a "leer" el archivo
            aplicarMetadatos({ title: track.title, artist: "Sincronizando...", album: "Syncfy Cloud" });

            // Leemos los metadatos reales del archivo que ya se está descargando
            // Solo intentamos leer si es cloud o tiene src válido
            if (window.jsmediatags) {
                window.jsmediatags.read(audioPlayer.src, {
                    onSuccess: function (tag) {
                        const info = {
                            title: tag.tags.title || track.title,
                            artist: tag.tags.artist || "Artista desconocido",
                            album: tag.tags.album || "Álbum"
                        };
                        // Guardamos en la memoria del navegador
                        localStorage.setItem(cacheKey, JSON.stringify(info));
                        // Aplicamos los cambios visuales
                        aplicarMetadatos(info);
                        console.log("Metadatos guardados para la próxima vez");
                    },
                    onError: (error) => {
                        console.log("No se pudieron leer etiquetas:", error.type, error.info);
                        // Fallback to initial track data if read fails
                        aplicarMetadatos({ title: track.title, artist: track.artist });
                    }
                });
            } else {
                aplicarMetadatos({ title: track.title, artist: track.artist });
            }
        }

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

        // Intentamos reproducir inmediatamente. 
        // El navegador gestionará el buffering automáticamente y la promesa se resolverá cuando empiece a sonar.
        const playPromise = audioPlayer.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log("Reproducción iniciada exitosamente");
                    state.isPlaying = true;
                    playIcon.className = 'ph-fill ph-pause';
                    currentArtEl.classList.add('playing');
                })
                .catch(error => {
                    if (error.name === 'AbortError') {
                        console.log("Carga interrumpida por nueva solicitud (normal).");
                    } else {
                        console.error("Error reproduciendo:", error);
                        // Si falla (ej. bloqueado por navegador), al menos actualizamos el icono a Play
                        state.isPlaying = false;
                        playIcon.className = 'ph-fill ph-play';
                    }
                });
        }
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
        // Priority: Queue
        if (state.queue.length > 0) {
            const nextTrack = state.queue.shift();
            // We set playlist index to -1 or handle distinct state, 
            // but for simplicity, we just load it. 
            // Warning: Pre/Next buttons might act weird if not in playlist context.
            // Ideally we insert it into current playlist? Or just play it.
            loadTrack(nextTrack);
            return;
        }

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

    function aplicarMetadatos(data) {
        trackNameEl.innerText = data.title;
        artistNameEl.innerText = data.artist;
        // Podríamos actualizar más cosas aquí si fuera necesario
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
    // --- Full Player Logic (Mobile) ---
    const fullPlayer = document.getElementById('fullPlayer');
    const closeFullPlayerBtn = document.getElementById('closeFullPlayer');
    const playerBar = document.querySelector('.player-bar');

    // Open Full Player on Mini Player Click (Mobile Only)
    playerBar.addEventListener('click', (e) => {
        // Prevent opening if clicking play/pause directly on mini player
        if (e.target.closest('.play-pause') || e.target.closest('.like-btn')) return;

        // Check if we are in mobile view (simplified check)
        if (window.innerWidth <= 768) {
            fullPlayer.classList.add('active');
            updateFullPlayerUI();
        }
    });

    closeFullPlayerBtn.addEventListener('click', () => {
        fullPlayer.classList.remove('active');
    });

    // Full Player Controls
    const fpPlayPause = document.getElementById('fpPlayPause');
    const fpPrev = document.getElementById('fpPrev');
    const fpNext = document.getElementById('fpNext');
    const fpShuffle = document.getElementById('fpShuffle');
    const fpRepeat = document.getElementById('fpRepeat');

    fpPlayPause.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay();
    });
    fpPrev.addEventListener('click', playPrev);
    fpNext.addEventListener('click', playNext);
    fpShuffle.addEventListener('click', toggleShuffle);
    fpRepeat.addEventListener('click', toggleRepeat);

    // Sync Full Player UI with Main State
    function updateFullPlayerUI() {
        if (!state.currentTrack) return;

        // Text Info
        document.getElementById('fpTitle').innerText = state.currentTrack.title;
        document.getElementById('fpArtist').innerText = state.currentTrack.artist || 'Desconocido';
        document.getElementById('fpContext').innerText = state.currentTrack.isLocal ? 'Archivos Locales' : 'Tu Nube';

        // Art
        const artUrl = state.currentTrack.img || 'icons/icon-512.png';
        document.getElementById('fpArt').src = artUrl;

        // Play/Pause Icon
        const icon = fpPlayPause.querySelector('i');
        icon.className = state.isPlaying ? 'ph-fill ph-pause' : 'ph-fill ph-play';

        // Toggles
        fpShuffle.classList.toggle('active', state.isShuffle);
        fpRepeat.classList.toggle('active', state.isRepeat);

        // Like (Mock)
        document.getElementById('fpLikeBtn').classList.toggle('active', likeBtn.classList.contains('active'));
    }

    // Hook into existing updates
    // We modify existing functions to also call updateFullPlayerUI()
    // A clean way is to observe state changes or just append calls.
    // Since we can't easily refactor everything, we'll augment specific points.

    // 1. Hook into loadTrack updates
    const originalLoadTrack = loadTrack;
    // We can't redefine local function easily without refactor. 
    // Instead we rely on the fact that existing functions modify DOM.
    // We'll add a MutationObserver to the mini-player track name to trigger updates.

    const observer = new MutationObserver(() => {
        updateFullPlayerUI();
    });
    observer.observe(document.getElementById('trackName'), { childList: true, subtree: true, characterData: true });

    // 2. Hook into Time Update for Progress Bar
    audioPlayer.addEventListener('timeupdate', () => {
        if (!fullPlayer.classList.contains('active')) return;

        const current = audioPlayer.currentTime;
        const duration = audioPlayer.duration || 1;
        const percent = (current / duration) * 100;

        document.getElementById('fpProgressFill').style.width = `${percent}%`;
        document.getElementById('fpCurrentTime').innerText = formatTime(current);
        document.getElementById('fpTotalTime').innerText = formatTime(duration);
    });

    // 3. Hook into Play/Pause Toggle for Icon
    audioPlayer.addEventListener('play', () => {
        const icon = fpPlayPause.querySelector('i');
        icon.className = 'ph-fill ph-pause';
    });
    audioPlayer.addEventListener('pause', () => {
        const icon = fpPlayPause.querySelector('i');
        icon.className = 'ph-fill ph-play';
    });

});
