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
        searchResults: [],
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
    document.querySelector('.main-nav li:nth-child(2)').addEventListener('click', (e) => { e.preventDefault(); renderSearch(); });
    document.querySelector('.mobile-nav a:nth-child(2)').addEventListener('click', (e) => { e.preventDefault(); renderSearch(); });

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

    window.renderHome = renderHome;

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
        const searchContainer = document.getElementById('searchContainer');
        if (searchContainer) searchContainer.remove();
    }

    // --- Unified Library Logic ---
    function renderSearch() {
        // Hide Home Sections
        heroSection.style.display = 'none';
        musicSections.forEach(el => el.style.display = 'none');

        // Visual updates
        document.querySelectorAll('.main-nav li').forEach(li => li.classList.remove('active'));
        document.querySelector('.main-nav li:nth-child(2)').classList.add('active');

        document.querySelectorAll('.mobile-nav a').forEach(a => a.classList.remove('active'));
        if (document.querySelector('.mobile-nav a:nth-child(2)')) {
            document.querySelector('.mobile-nav a:nth-child(2)').classList.add('active');
        }

        // Cleanup other views
        const existingList = document.getElementById('localLinksList');
        if (existingList) existingList.remove();

        let searchContainer = document.getElementById('searchContainer');
        if (!searchContainer) {
            searchContainer = document.createElement('div');
            searchContainer.id = 'searchContainer';
            searchContainer.className = 'search-container';
            mainContent.appendChild(searchContainer);
        }

        searchContainer.innerHTML = `
            <div class="search-header-container" style="padding: 24px 32px;">
                <div class="search-input-wrapper" style="position: relative; max-width: 400px;">
                     <i class="ph-bold ph-magnifying-glass" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #000;"></i>
                     <input type="text" id="searchInput" placeholder="¿Qué quieres escuchar?" 
                     style="width: 100%; padding: 14px 14px 14px 48px; border-radius: 24px; border: none; outline: none; font-size: 16px; font-weight: 500; color: #000;">
                </div>
            </div>
            <div id="searchResults" class="local-files-container">
                <div style="text-align: center; padding: 40px; color: var(--text-subdued);">
                    <i class="ph-magnifying-glass" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
                    <p>Busca canciones, artistas o podcasts.</p>
                </div>
            </div>
        `;

        const input = document.getElementById('searchInput');
        const resultsContainer = document.getElementById('searchResults');
        input.focus();

        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                resultsContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-subdued);">
                        <i class="ph-magnifying-glass" style="font-size: 48px; margin-bottom: 20px; display: block;"></i>
                        <p>Busca canciones, artistas o podcasts.</p>
                    </div>`;
                return;
            }

            const allTracks = [...state.localTracks, ...state.cloudTracks];
            const results = allTracks.filter(track =>
                (track.title && track.title.toLowerCase().includes(query)) ||
                (track.artist && track.artist.toLowerCase().includes(query))
            );

            state.searchResults = results;

            if (results.length === 0) {
                resultsContainer.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--text-subdued);">
                        <p>No se encontraron resultados para "${e.target.value}"</p>
                    </div>`;
            } else {
                renderTrackList(results, resultsContainer, 'search');
            }
        });
    }

    // --- Unified Library Logic ---
    function renderLibrary() {
        // Hide Home Sections
        heroSection.style.display = 'none';
        musicSections.forEach(el => el.style.display = 'none');

        const searchContainer = document.getElementById('searchContainer');
        if (searchContainer) searchContainer.remove();

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
            <div class="action-header" style="display: flex; gap: 16px; align-items: center; padding: 24px 16px;">
                <button class="pin-submit-btn" onclick="playContext('${source}', '${playlistId || ''}')" style="width: auto; padding: 12px 32px; display: flex; align-items: center; gap: 8px;">
                     <i class="ph-fill ph-play" style="color: #000; font-size: 20px;"></i>
                     Reproducir
                </button>
                <button class="icon-btn" onclick="toggleShuffleContext('${source}', '${playlistId || ''}')" style="background: transparent; border: 1px solid #555; border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: ${state.isShuffle ? '#1DB954' : '#fff'}; transition: all 0.2s;">
                    <i class="ph-bold ph-shuffle" style="font-size: 24px;"></i>
                </button>
            </div>

            <div class="track-list-header track-list-grid">
                <span>#</span>
                <span>Título</span>
                <span class="desktop-only">Artista</span>
                <span></span>
            </div>
            <div class="tracks-wrapper">
                ${tracks.map((track, index) => `
                    <div class="track-item track-item-grid" onclick="playTrack(${index}, '${source}', '${playlistId || ''}')">
                        <span class="track-index">${index + 1}</span>
                        <div class="track-info">
                            <img src="${track.img}" class="track-thumb">
                            <div class="track-text">
                                <span class="track-title" style="color: ${state.currentTrack === track ? 'var(--accent-color)' : 'var(--text-base)'};">${track.title}</span>
                                <span class="track-artist-mobile">${track.artist}</span>
                            </div>
                        </div>
                        <span class="track-artist-desktop desktop-only">${track.artist}</span>
                        <button class="extra-btn" onclick="openContextMenu(event, ${index}, '${source}', '${playlistId || ''}')"><i class="ph-bold ph-dots-three"></i></button>
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
    const GAS_URL = "https://script.google.com/macros/s/AKfycbxl8Vl3P7tioOnKf7Y7jhDWlGPSoVoOkPJhmZ8Hnp-GPh4yH-lMa2HbDMk3ThXz1lPC/exec";
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
                id: item.id,
                title: item.title,
                artist: item.artist,
                src: item.url, // Keep original URL as backup/reference
                img: "icons/icon-512.png",
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

    // Expose Play Context
    window.playContext = function (source, playlistId) {
        state.isShuffle = false;
        playTrack(0, source, playlistId);
        updateShuffleStateUI();
    };

    window.toggleShuffleContext = function (source, playlistId) {
        toggleShuffle(); // Toggles state.isShuffle
        updateShuffleStateUI();

        // If not playing, or playing different context, start playing with new shuffle state
        // Re-using logic from playTrack(0) roughly, but playNext random
        if (!state.isPlaying) {
            playTrack(0, source, playlistId);
            // Note: playTrack uses index, then loadTrack. 
            // If shuffle is ON, next track logic applies later. 
            // To start *randomly* immediately, we'd need playNext logic here.
            // But simpler: just start playing index 0, and next will be random.
            // OR: pick random index:
            if (state.isShuffle) {
                let list = [];
                if (source === 'library') list = [...state.localTracks, ...state.cloudTracks];
                else if (source === 'playlist') list = state.playlists.find(p => p.id == playlistId).tracks;
                else if (source === 'search') list = state.searchResults;

                if (list.length > 0) {
                    const randIndex = Math.floor(Math.random() * list.length);
                    playTrack(randIndex, source, playlistId);
                }
            }
        }
    };

    function updateShuffleStateUI() {
        const btns = document.querySelectorAll('.action-header .icon-btn');
        btns.forEach(btn => {
            btn.style.color = state.isShuffle ? '#1DB954' : '#fff';
            btn.style.borderColor = state.isShuffle ? '#1DB954' : '#555';
        });
        // Also update main player bar
        shuffleBtn.classList.toggle('active', state.isShuffle);
        const fpShuffle = document.getElementById('fpShuffle');
        if (fpShuffle) fpShuffle.classList.toggle('active', state.isShuffle);
    }

    // Expose playTrack to global scope for HTML onclick
    window.playTrack = function (index, source, playlistId = null) {
        console.log(`User clicked track ${index} from ${source}`);
        if (event && event.target && event.target.closest('.extra-btn')) return; // Prevent click if clicking the dots

        // Handle 'current-context' source (used by Queue)
        if (source === 'current-context') {
            state.currentIndex = index;
            loadTrack(state.playlist[index]);
            return;
        }

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
        } else if (source === 'search') {
            // Only play the selected track, ignore the rest of the search results
            const selectedTrack = state.searchResults[index];
            targetPlaylist = [selectedTrack];
            index = 0; // Reset index since playlist is now size 1
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
        else if (source === 'search') list = state.searchResults;

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
            // Check if Guest
            if (typeof isHost !== 'undefined' && !isHost && dataChannel && dataChannel.readyState === 'open') {
                // Send to Host
                dataChannel.send(JSON.stringify({
                    type: 'ADD_TO_QUEUE',
                    track: ctxTrack,
                    user: 'Guest',
                    color: myColor
                }));
                if (typeof showNotification === 'function') showNotification("Solicitud enviada al Host");
            } else {
                // Local/Host Logic
                state.queue.push(ctxTrack);
                console.log("Added to queue", ctxTrack.title);
                if (typeof showNotification === 'function') showNotification("Añadido a la cola");

                if (typeof isHost !== 'undefined' && isHost && typeof syncHostState === 'function') syncHostState();
            }
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
            // Usamos los datos directos del objeto (que ya vienen limpios del JSON)
            aplicarMetadatos({ title: track.title, artist: track.artist, album: "Syncfy Cloud" });
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

        // Broadcast Play
        if (typeof broadcastCommand === 'function') broadcastCommand('play');
    }

    function pauseAudio() {
        audioPlayer.pause();
        state.isPlaying = false;
        playIcon.className = 'ph-fill ph-play'; // Explicitly set the play icon
        currentArtEl.classList.remove('playing');

        // Broadcast Pause
        if (typeof broadcastCommand === 'function') broadcastCommand('pause');
    }

    function toggleShuffle() {
        state.isShuffle = !state.isShuffle;
        shuffleBtn.classList.toggle('active', state.isShuffle);
        if (fpShuffle) fpShuffle.classList.toggle('active', state.isShuffle);
    }

    function toggleRepeat() {
        state.isRepeat = !state.isRepeat;
        repeatBtn.classList.toggle('active', state.isRepeat);
        if (fpRepeat) fpRepeat.classList.toggle('active', state.isRepeat);
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

        // Broadcast Seek
        if (typeof broadcastCommand === 'function') broadcastCommand('seek', audioPlayer.currentTime);
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

        // Update Document Title (Browser Tab / System Fallback)
        document.title = `${data.title} • ${data.artist}`;

        // Media Session API (System Notifications / Lock Screen)
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: data.title,
                artist: data.artist,
                album: data.album || 'Syncfy',
                artwork: [
                    { src: state.currentTrack?.img || 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }
                ]
            });

            // Action Handlers
            navigator.mediaSession.setActionHandler('play', () => {
                if (audioPlayer.paused) togglePlay();
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                if (!audioPlayer.paused) togglePlay();
            });
            navigator.mediaSession.setActionHandler('previoustrack', playPrev);
            navigator.mediaSession.setActionHandler('nexttrack', playNext);

            // Optional: Seek handlers
            try {
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    if (details.fastSeek && 'fastSeek' in audioPlayer) {
                        audioPlayer.fastSeek(details.seekTime);
                        return;
                    }
                    audioPlayer.currentTime = details.seekTime;
                    updateProgress();
                });
            } catch (e) { }
        }
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

    // Mobile Seeking Logic
    const fpProgressWrapper = document.getElementById('fpProgressWrapper');
    let isDraggingFp = false;

    function handleFpSeek(clientX) {
        if (!audioPlayer.duration) return;
        const rect = fpProgressWrapper.getBoundingClientRect();
        const width = rect.width;
        const offsetX = clientX - rect.left;
        let percent = offsetX / width;
        if (percent < 0) percent = 0;
        if (percent > 1) percent = 1;

        audioPlayer.currentTime = percent * audioPlayer.duration;
        // Update visual immediately
        document.getElementById('fpProgressFill').style.width = `${percent * 100}%`;
        document.getElementById('fpCurrentTime').innerText = formatTime(audioPlayer.currentTime);
    }

    fpProgressWrapper.addEventListener('click', (e) => {
        handleFpSeek(e.clientX);
    });

    fpProgressWrapper.addEventListener('touchstart', (e) => {
        isDraggingFp = true;
    });

    fpProgressWrapper.addEventListener('touchmove', (e) => {
        if (!isDraggingFp) return;
        // Prevent scroll while scrubbing
        e.preventDefault();

        // Update visual but don't seek audio yet (too laggy) or seek if performant
        const rect = fpProgressWrapper.getBoundingClientRect();
        const width = rect.width;
        const offsetX = e.touches[0].clientX - rect.left;
        let percent = offsetX / width;
        if (percent < 0) percent = 0;
        if (percent > 1) percent = 1;

        document.getElementById('fpProgressFill').style.width = `${percent * 100}%`;
        document.getElementById('fpCurrentTime').innerText = formatTime(percent * audioPlayer.duration);
    });

    fpProgressWrapper.addEventListener('touchend', (e) => {
        if (isDraggingFp) {
            handleFpSeek(e.changedTouches[0].clientX);
            isDraggingFp = false;
        }
    });

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
    // 3. Hook into Play/Pause Toggle for Icon
    audioPlayer.addEventListener('play', () => {
        const icon = fpPlayPause.querySelector('i');
        icon.className = 'ph-fill ph-pause';
    });
    audioPlayer.addEventListener('pause', () => {
        const icon = fpPlayPause.querySelector('i');
        icon.className = 'ph-fill ph-play';
    });


    // --- Queue View Logic ---
    const queueOverlay = document.getElementById('queueOverlay');
    const queueContent = document.getElementById('queueContent');
    const closeQueueBtn = document.getElementById('closeQueueBtn');
    const mobileQueueBtn = document.getElementById('mobileQueueBtn');

    // Updated Desktop Selector with ID
    const desktopQueueBtn = document.getElementById('desktopQueueBtn');

    function toggleQueue() {
        const isActive = queueOverlay.classList.contains('active');
        if (isActive) {
            queueOverlay.classList.remove('active');
        } else {
            renderQueueUI();
            queueOverlay.classList.add('active');
        }
    }

    if (mobileQueueBtn) mobileQueueBtn.addEventListener('click', toggleQueue);
    if (desktopQueueBtn) desktopQueueBtn.addEventListener('click', toggleQueue);
    else {
        // Fallback if ID not found yet (should be there)
        const oldBtn = document.querySelector('.player-bar .ph-list');
        if (oldBtn) oldBtn.closest('button').addEventListener('click', toggleQueue);
    }

    if (closeQueueBtn) closeQueueBtn.addEventListener('click', () => queueOverlay.classList.remove('active'));

    let draggedItemIndex = null;

    function renderQueueUI() {
        if (!queueContent) return;
        queueContent.innerHTML = '';

        // 1. Now Playing
        if (state.currentTrack) {
            const nowPlayingDiv = document.createElement('div');
            nowPlayingDiv.innerHTML = `
                <div class="queue-section-title">Reproduciendo ahora</div>
                <div class="queue-item playing">
                    <img src="${state.currentTrack.img}" alt="Art">
                    <div class="queue-item-info">
                        <span class="queue-item-title">${state.currentTrack.title}</span>
                        <span class="queue-item-artist">${state.currentTrack.artist}</span>
                    </div>
                    <i class="ph-fill ph-speaker-high" style="color: var(--accent-color);"></i>
                </div>
            `;
            queueContent.appendChild(nowPlayingDiv);
        }

        // 2. User Queue (Manually added) - DRAGGABLE
        if (state.queue.length > 0) {
            const userQueueDiv = document.createElement('div');
            userQueueDiv.innerHTML = `<div class="queue-section-title">A continuación en la cola</div>`;

            state.queue.forEach((track, idx) => {
                const item = createQueueItem(track, () => {
                    // Remove from queue and play
                    state.queue.splice(idx, 1);
                    loadTrack(track);
                }, true, idx); // draggable=true
                userQueueDiv.appendChild(item);
            });
            queueContent.appendChild(userQueueDiv);
        }

        // 3. Next from Context (Playlist)
        if (state.playlist.length > 0) {
            const ctxEl = document.getElementById('fpContext');
            const contextName = ctxEl ? ctxEl.innerText : 'Contexto';
            const nextTracksDiv = document.createElement('div');
            nextTracksDiv.innerHTML = `<div class="queue-section-title">A continuación de: ${contextName}</div>`;

            let nextIndex = state.currentIndex + 1;
            let count = 0;
            const maxToShow = 20;

            while (nextIndex < state.playlist.length && count < maxToShow) {
                const track = state.playlist[nextIndex];
                const captureIndex = nextIndex;
                const item = createQueueItem(track, () => {
                    playTrack(captureIndex, 'current-context');
                });
                nextTracksDiv.appendChild(item);
                nextIndex++;
                count++;
            }
            queueContent.appendChild(nextTracksDiv);
        }
    }

    function createQueueItem(track, onClick, draggable = false, index = -1) {
        const div = document.createElement('div');
        div.className = 'queue-item';
        if (track.color) div.style.borderLeft = `4px solid ${track.color}`; // Show Guest Color
        div.innerHTML = `
            <img src="${track.img}" alt="Art">
            <div class="queue-item-info">
                <span class="queue-item-title">${track.title}</span>
                <span class="queue-item-artist">${track.artist}</span>
            </div>
            ${draggable ? '<i class="ph-bold ph-list" style="margin-left:auto; color: #666; cursor: grab;"></i>' : ''}
        `;

        if (draggable) {
            div.setAttribute('draggable', 'true');
            div.style.cursor = 'grab';

            div.addEventListener('dragstart', (e) => {
                draggedItemIndex = index;
                div.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                // Set minimal data to satisfy DnD
                e.dataTransfer.setData('text/plain', index);
            });

            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
                draggedItemIndex = null;
            });

            div.addEventListener('dragover', (e) => {
                e.preventDefault(); // Allow dropping
                e.dataTransfer.dropEffect = 'move';
            });

            div.addEventListener('drop', (e) => {
                e.preventDefault();
                if (draggedItemIndex === null || draggedItemIndex === index) return;

                // Reorder array
                // Move FROM draggedItemIndex TO index
                const itemToMove = state.queue[draggedItemIndex];
                state.queue.splice(draggedItemIndex, 1);
                state.queue.splice(index, 0, itemToMove);

                // Update UI
                renderQueueUI();
            });
        }

        div.addEventListener('click', (e) => {
            // Don't trigger play if clicking the drag handle
            if (!e.target.closest('.ph-list')) {
                onClick();
            }
        });

        return div;
    }

    // Update Full Player Background on Track Load
    // We hook into the mutation observer we already added or just add logic to updateFullPlayerUI
    const originalUpdateFP = updateFullPlayerUI;
    updateFullPlayerUI = function () {
        // Call original
        if (typeof originalUpdateFP === 'function') originalUpdateFP();

        // Update Background based on track color or fallback
        const bg = document.querySelector('.full-player-overlay');
        const color = state.currentTrack && state.currentTrack.color ? state.currentTrack.color : '#533E3E';

        // Use a radial gradient for that 'spotlight' effect
        if (bg) bg.style.background = `radial-gradient(circle at center top, ${color} 0%, #121212 90%)`;

        // Refresh Queue if active
        if (queueOverlay && queueOverlay.classList.contains('active')) {
            renderQueueUI();
        }
    };


    // --- JAM / P2P LOGIC ---
    let signalingSocket = null;
    let peerConnection = null;
    let dataChannel = null;
    let jamRoomId = null;
    let isHost = false;
    let myColor = '#FFC212'; // Default
    const SIGNALING_URL = 'wss://syncfy-signalin.onrender.com';

    // UI Elements
    const jamModal = document.getElementById('jamModal');
    const openJamModalBtn = document.getElementById('openJamModalBtn');
    const closeJamModalBtn = document.getElementById('closeJamModalBtn');
    const jamTabs = document.querySelectorAll('.jam-tab');
    const hostView = document.getElementById('hostView');
    const guestView = document.getElementById('guestView');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const hostStatus = document.getElementById('hostStatus');
    const guestStatus = document.getElementById('guestStatus');
    const colorPicker = document.getElementById('colorPicker');

    // Init Icons
    if (window.lucide) lucide.createIcons();

    // Event Listeners
    if (openJamModalBtn) openJamModalBtn.addEventListener('click', () => {
        jamModal.style.display = 'flex';
    });

    const mobileJamBtn = document.getElementById('mobileJamBtn');
    if (mobileJamBtn) mobileJamBtn.addEventListener('click', () => {
        jamModal.style.display = 'flex';
    });

    if (closeJamModalBtn) closeJamModalBtn.addEventListener('click', () => {
        jamModal.style.display = 'none';
        // disconnect? maybe not, background jam
    });

    jamTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            jamTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (tab.dataset.tab === 'host') {
                hostView.classList.add('active');
                guestView.classList.remove('active');
                if (!jamRoomId) startHosting();
            } else {
                hostView.classList.remove('active');
                guestView.classList.add('active');
            }
        });
    });

    // Color Picker
    if (colorPicker) {
        colorPicker.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option')) {
                document.querySelectorAll('.color-option').forEach(el => el.classList.remove('selected'));
                e.target.classList.add('selected');
                myColor = e.target.dataset.color;
            }
        });
    }

    if (joinRoomBtn) joinRoomBtn.addEventListener('click', async () => {
        const roomCode = document.getElementById('joinRoomInput').value.toUpperCase();
        if (roomCode.length !== 4) {
            guestStatus.innerText = "Código inválido (4 letras)";
            return;
        }

        // CHECK PIN FIRST
        // If global `state.cloudTracks` is empty, we force a PIN check.
        if (state.cloudTracks.length === 0) {
            const pin = prompt("🔐 PIN de la Nube requerido para unirte:");
            if (!pin) return;
            try {
                guestStatus.innerText = "Verificando PIN...";
                const tracks = await fetchCloudMusic(pin);
                state.cloudTracks = tracks; // This populates local library for context
                guestStatus.innerText = "PIN Correcto. Conectando...";
            } catch (e) {
                guestStatus.innerText = "PIN Incorrecto.";
                return;
            }
        }

        joinJam(roomCode);
    });

    // P2P Functions
    function startHosting() {
        isHost = true;
        jamRoomId = generateRoomId();
        document.getElementById('hostRoomCode').innerText = jamRoomId;

        // QR Code
        const qrContainer = document.getElementById('qrcode');
        qrContainer.innerHTML = "";
        const url = `${window.location.origin}${window.location.pathname}?room=${jamRoomId}`;
        new QRCode(qrContainer, {
            text: url,
            width: 128,
            height: 128,
            colorDark: "#000000",
            colorLight: "#ffffff",
        });

        hostStatus.innerText = "Conectando al servidor...";
        connectSignaling(jamRoomId, 'create');
    }

    function joinJam(roomId) {
        isHost = false;
        jamRoomId = roomId;
        guestStatus.innerText = "Conectando al servidor...";
        connectSignaling(roomId, 'join');
    }

    function generateRoomId() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let result = "";
        for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
        return result;
    }

    function connectSignaling(room, action) {
        signalingSocket = new WebSocket(SIGNALING_URL);

        signalingSocket.onopen = () => {
            console.log("WS Connected");
            signalingSocket.send(JSON.stringify({ type: action, room: room }));
            if (isHost) hostStatus.innerText = "Esperando invitados...";
        };

        signalingSocket.onmessage = async (msg) => {
            const data = JSON.parse(msg.data);
            console.log("Signal:", data);

            if (data.type === 'offer') {
                if (!isHost) {
                    // Guest receives offer
                    await setupPeerConnection();
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                    const answer = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answer);
                    signalingSocket.send(JSON.stringify({ type: 'answer', room: jamRoomId, answer: answer }));
                }
            } else if (data.type === 'answer') {
                if (isHost) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                }
            } else if (data.type === 'candidate') {
                if (peerConnection) {
                    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            } else if (data.type === 'joined') {
                if (isHost) {
                    hostStatus.innerText = "Invitado detectado. Iniciando P2P...";
                    createPeerConnection(); // Host initiates
                }
            } else if (data.type === 'error') {
                alert("Error: " + data.message);
            }
        };
    }

    async function createPeerConnection() {
        await setupPeerConnection();
        dataChannel = peerConnection.createDataChannel("syncfy-jam");
        setupDataChannelEvents();

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        signalingSocket.send(JSON.stringify({ type: 'offer', room: jamRoomId, offer: offer }));
    }

    async function setupPeerConnection() {
        const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        peerConnection = new RTCPeerConnection(config);

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                signalingSocket.send(JSON.stringify({ type: 'candidate', room: jamRoomId, candidate: event.candidate }));
            }
        };

        peerConnection.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannelEvents();
        };

        peerConnection.onconnectionstatechange = () => {
            console.log("P2P State:", peerConnection.connectionState);
        };
    }

    function setupDataChannelEvents() {
        dataChannel.onopen = () => {
            console.log("Data Channel OPEN");
            if (isHost) {
                hostStatus.innerText = "¡Conectado P2P!";
                // Send Initial State
                syncHostState();
            } else {
                guestStatus.innerText = "¡Conectado a la Jam!";
            }
        };

        dataChannel.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            handleP2PMessage(msg);
        };
    }

    function handleP2PMessage(msg) {
        if (msg.type === 'SYNC_PLAYLIST') {
            // Guest receives playlist
            state.playlist = msg.playlist;
            state.queue = msg.queue;
            state.currentTrack = msg.currentTrack; // May need to just use ID to avoid duplication
            state.currentIndex = msg.currentIndex;

            showNotification(`Sincronizado con Host`);
        } else if (msg.type === 'SYNC_COMMAND') {
            // Guest playback control
            if (msg.command === 'play') {
                // Try to find track
                if (audioPlayer.src !== msg.src) {
                    audioPlayer.src = msg.src;
                }
                audioPlayer.currentTime = msg.time;
                audioPlayer.play();
                state.isPlaying = true;
                updatePlayBtnUI();
            } else if (msg.command === 'pause') {
                audioPlayer.pause();
                state.isPlaying = false;
                updatePlayBtnUI();
            } else if (msg.command === 'seek') {
                audioPlayer.currentTime = msg.time;
            }
        } else if (msg.type === 'ADD_TO_QUEUE') {
            // Host receives request
            const track = msg.track;
            track.addedBy = msg.user;
            track.color = msg.color;
            state.queue.push(track);

            // Show visually
            if (typeof showNotification === 'function') showNotification(`Canción añadida por Invitado`);

            // Broadcast update
            syncHostState();

            // If queue UI is open, refresh it
            const queueOverlay = document.getElementById('queueOverlay');
            if (queueOverlay && queueOverlay.style.display !== 'none') {
                // Trigger refresh logic? The existing code doesn't have a clear "renderQueue" public function
                // We might need to expose one or click the button.
            }
        }
    }

    function syncHostState() {
        if (dataChannel && dataChannel.readyState === 'open') {
            const payload = {
                type: 'SYNC_PLAYLIST',
                playlist: state.playlist,
                queue: state.queue,
                currentTrack: state.currentTrack,
                currentIndex: state.currentIndex
            };
            dataChannel.send(JSON.stringify(payload));
        }
    }

    function broadcastCommand(cmd, time = 0) {
        if (isHost && dataChannel && dataChannel.readyState === 'open') {
            console.log("Broadcasting", cmd);
            dataChannel.send(JSON.stringify({
                type: 'SYNC_COMMAND',
                command: cmd,
                time: time || audioPlayer.currentTime,
                src: state.currentTrack ? state.currentTrack.src : ''
            }));
        }
    }

    // Expose for patching
    window.broadcastCommand = broadcastCommand;
    window.isHost = isHost; // Value copy issue? No, we need a getter
    window.getIsHost = () => isHost;
    window.getMyColor = () => myColor;

    // DEEP LINK CHECK
    const urlParams = new URLSearchParams(window.location.search);
    const roomSnap = urlParams.get('room');
    if (roomSnap) {
        jamModal.style.display = 'flex';
        // Select Guest Mode
        jamTabs[1].click();
        const input = document.getElementById('joinRoomInput');
        if (input) input.value = roomSnap;
    }

}); // END OF DOMContentLoaded

