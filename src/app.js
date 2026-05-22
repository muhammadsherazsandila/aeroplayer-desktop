/* AeroPlayer Application Logic - Premium Tauri Integration */

document.addEventListener('DOMContentLoaded', () => {
    // Lucide Icons Initialization
    lucide.createIcons();

    // DOM Elements
    const mainVideo = document.getElementById('mainVideo');
    const playBtn = document.getElementById('playBtn');
    const playIcon = document.getElementById('playIcon');
    const rewindBtn = document.getElementById('rewindBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const timeCurrent = document.getElementById('timeCurrent');
    const timeTotal = document.getElementById('timeTotal');
    const timelineContainer = document.getElementById('timelineContainer');
    const timelineProgress = document.getElementById('timelineProgress');
    const timelineHover = document.getElementById('timelineHover');
    const timelineHandle = document.getElementById('timelineHandle');
    const volumeBtn = document.getElementById('volumeBtn');
    const volumeIcon = document.getElementById('volumeIcon');
    const volumeSlider = document.getElementById('volumeSlider');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = document.getElementById('fullscreenIcon');
    const ejectBtn = document.getElementById('ejectBtn');
    const fileInput = document.getElementById('fileInput');
    const videoWrapper = document.getElementById('videoWrapper');
    const videoOverlay = document.getElementById('videoOverlay');
    const overlayPlayBtn = document.getElementById('overlayPlayBtn');
    const seekToast = document.getElementById('seekToast');

    // Scanned Video Elements
    const playlistDrawer = document.getElementById('playlistDrawer');
    const playlistItems = document.getElementById('playlistItems');
    const videoCount = document.getElementById('videoCount');
    const storagePrompt = document.getElementById('storagePrompt');
    const scanAccessBtn = document.getElementById('scanAccessBtn');
    const fallbackBrowseLink = document.getElementById('fallbackBrowseLink');
    const scanningLoader = document.getElementById('scanningLoader');

    // Titlebar Dropdowns
    const shortcutsDropdown = document.getElementById('shortcutsDropdown');
    const streamsDropdown = document.getElementById('streamsDropdown');
    const winPlaylistToggleBtn = document.getElementById('winPlaylistToggleBtn');
    const winStreamsBtn = document.getElementById('winStreamsBtn');
    const winShortcutsBtn = document.getElementById('winShortcutsBtn');
    const winInfoBtn = document.getElementById('winInfoBtn');

    // State Variables
    let isDraggingTimeline = false;
    let idleTimer = null;
    let toastTimer = null;
    let scannedVideosList = [];

    const isTauri = typeof window.__TAURI__ !== 'undefined';

    // ----------------------------------------------------
    // Icon Updating Helper
    // ----------------------------------------------------
    function updateIcon(element, iconName) {
        if (!element) return;
        element.setAttribute('data-lucide', iconName);
        lucide.createIcons();
    }

    // ----------------------------------------------------
    // Video Loader / Media Management
    // ----------------------------------------------------
    function loadVideoSource(source, isFile = false) {
        let videoUrl = '';
        if (isFile) {
            videoUrl = URL.createObjectURL(source);
        } else {
            // Absolute local paths in Tauri are converted to the high-performance local asset:// protocol
            if (isTauri && typeof source === 'string' && !source.startsWith('http://') && !source.startsWith('https://') && !source.startsWith('blob:')) {
                videoUrl = window.__TAURI__.core.convertFileSrc(source);
            } else {
                videoUrl = source;
            }
        }

        // Set video src and reveal wrapper
        mainVideo.src = videoUrl;
        storagePrompt.classList.add('hidden');
        videoWrapper.classList.remove('hidden');

        // Play the video automatically
        mainVideo.load();
        
        // Wait for metadata to load total duration
        mainVideo.addEventListener('loadedmetadata', () => {
            timeTotal.textContent = formatTime(mainVideo.duration);
            timeCurrent.textContent = '00:00';
            updateProgressBar();
        });

        // Trigger autoplay after load
        mainVideo.play().then(() => {
            togglePlayState(true);
        }).catch(err => {
            console.log("Autoplay blocked or failed, waiting for user play interaction", err);
            togglePlayState(false);
        });
    }

    function ejectVideo() {
        mainVideo.pause();
        mainVideo.src = '';
        videoWrapper.classList.add('hidden');
        storagePrompt.classList.remove('hidden');
        // Revoke object URL to free up browser memory if applicable
        if (mainVideo.src.startsWith('blob:')) {
            URL.revokeObjectURL(mainVideo.src);
        }
        // Deselect active items
        const items = playlistItems.querySelectorAll('.playlist-item');
        items.forEach(item => item.classList.remove('active'));
    }

    // ----------------------------------------------------
    // Manual file fallback selection
    // ----------------------------------------------------
    fallbackBrowseLink.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadVideoSource(e.target.files[0], true);
        }
    });

    ejectBtn.addEventListener('click', ejectVideo);

    // ----------------------------------------------------
    // Video Scanning & Permission Mechanics
    // ----------------------------------------------------
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    async function performVideoScan() {
        if (!isTauri) {
            // Fallback demo mock scan in standard web browsers
            showBrowserMockScan();
            return;
        }

        storagePrompt.classList.add('hidden');
        scanningLoader.classList.remove('hidden');

        try {
            const files = await window.__TAURI__.core.invoke("scan_videos");
            scannedVideosList = files || [];
            renderPlaylist(scannedVideosList);
            
            if (scannedVideosList.length > 0) {
                localStorage.setItem('aeroplayer_storage_scanned', 'true');
                playlistDrawer.classList.remove('collapsed');
                playPlaylistItem(0);
            } else {
                playlistItems.innerHTML = `
                    <div class="playlist-empty-state">
                        <i data-lucide="folder-search" class="empty-icon"></i>
                        <p>No video files found in your system's Videos or Downloads folders.</p>
                    </div>
                `;
                lucide.createIcons();
                storagePrompt.classList.remove('hidden');
            }
        } catch (err) {
            console.error("Scanning videos failed", err);
            storagePrompt.classList.remove('hidden');
        } finally {
            scanningLoader.classList.add('hidden');
        }
    }

    function renderPlaylist(videos) {
        playlistItems.innerHTML = '';
        videoCount.textContent = `${videos.length} video${videos.length === 1 ? '' : 's'}`;

        if (videos.length === 0) {
            playlistItems.innerHTML = `
                <div class="playlist-empty-state">
                    <i data-lucide="folder-search" class="empty-icon"></i>
                    <p>No scanned videos yet. Grant storage access to populate.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        videos.forEach((video, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.index = index;

            const sizeFormatted = formatBytes(video.size);

            item.innerHTML = `
                <div class="playlist-item-icon">
                    <i data-lucide="video"></i>
                </div>
                <div class="playlist-item-details">
                    <div class="playlist-item-title" title="${video.name}">${video.name}</div>
                    <div class="playlist-item-size">${sizeFormatted}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                playPlaylistItem(index);
            });

            playlistItems.appendChild(item);
        });

        lucide.createIcons();
    }

    function playPlaylistItem(index) {
        const items = playlistItems.querySelectorAll('.playlist-item');
        items.forEach((item, idx) => {
            if (idx === index) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        const video = scannedVideosList[index];
        if (video) {
            loadVideoSource(video.path, false);
        }
    }

    function showBrowserMockScan() {
        storagePrompt.classList.add('hidden');
        scanningLoader.classList.remove('hidden');

        setTimeout(() => {
            scanningLoader.classList.add('hidden');
            scannedVideosList = [
                {
                    name: "Sintel (Fantasy Demo)",
                    path: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                    size: 34500000,
                    extension: "mp4"
                },
                {
                    name: "Big Buck Bunny (Animation Demo)",
                    path: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                    size: 26300000,
                    extension: "mp4"
                }
            ];
            renderPlaylist(scannedVideosList);
            localStorage.setItem('aeroplayer_storage_scanned', 'true');
            playlistDrawer.classList.remove('collapsed');
            playPlaylistItem(0);
        }, 1500);
    }

    scanAccessBtn.addEventListener('click', performVideoScan);

    // Auto-scan if permission was previously granted
    if (localStorage.getItem('aeroplayer_storage_scanned') === 'true') {
        performVideoScan();
    }

    // Collapsible Drawer Toggling
    winPlaylistToggleBtn.addEventListener('click', () => {
        playlistDrawer.classList.toggle('collapsed');
    });

    // ----------------------------------------------------
    // Dropdowns Position & Toggle Mechanics
    // ----------------------------------------------------
    function toggleDropdown(dropdown, button) {
        if (dropdown === shortcutsDropdown) {
            streamsDropdown.classList.remove('visible');
            streamsDropdown.classList.add('hidden');
        } else {
            shortcutsDropdown.classList.remove('visible');
            shortcutsDropdown.classList.add('hidden');
        }

        const isVisible = dropdown.classList.contains('visible');
        if (isVisible) {
            dropdown.classList.remove('visible');
            dropdown.classList.add('hidden');
        } else {
            dropdown.classList.remove('hidden');
            dropdown.classList.add('visible');
            positionDropdown(button, dropdown);
        }
    }

    function positionDropdown(btn, dropdown) {
        const btnRect = btn.getBoundingClientRect();
        dropdown.style.top = `${btnRect.bottom + 8}px`;
        
        const dropdownWidth = 300;
        let left = btnRect.left + (btnRect.width / 2) - (dropdownWidth / 2);
        left = Math.max(10, Math.min(window.innerWidth - dropdownWidth - 10, left));
        dropdown.style.left = `${left}px`;
    }

    winShortcutsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(shortcutsDropdown, winShortcutsBtn);
    });

    winStreamsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(streamsDropdown, winStreamsBtn);
    });

    // Handle Quick Demo Select
    const demoButtons = document.querySelectorAll('.demo-select-btn');
    demoButtons.forEach(button => {
        button.addEventListener('click', () => {
            const videoUrl = button.getAttribute('data-url');
            loadVideoSource(videoUrl, false);
            streamsDropdown.classList.remove('visible');
            streamsDropdown.classList.add('hidden');
        });
    });

    // Close Dropdowns on outside click
    window.addEventListener('click', (e) => {
        if (!shortcutsDropdown.contains(e.target) && e.target !== winShortcutsBtn && !winShortcutsBtn.contains(e.target)) {
            shortcutsDropdown.classList.remove('visible');
            shortcutsDropdown.classList.add('hidden');
        }
        if (!streamsDropdown.contains(e.target) && e.target !== winStreamsBtn && !winStreamsBtn.contains(e.target)) {
            streamsDropdown.classList.remove('visible');
            streamsDropdown.classList.add('hidden');
        }
    });

    // Close Dropdowns on window resize
    window.addEventListener('resize', () => {
        if (shortcutsDropdown.classList.contains('visible')) {
            positionDropdown(winShortcutsBtn, shortcutsDropdown);
        }
        if (streamsDropdown.classList.contains('visible')) {
            positionDropdown(winStreamsBtn, streamsDropdown);
        }
    });

    // ----------------------------------------------------
    // Core Playback Functions
    // ----------------------------------------------------
    function togglePlayState(shouldPlay) {
        if (shouldPlay) {
            videoWrapper.classList.add('playing');
            updateIcon(playIcon, 'pause');
            updateIcon(overlayPlayBtn.querySelector('i'), 'pause');
            resetIdleTimer();
        } else {
            videoWrapper.classList.remove('playing');
            updateIcon(playIcon, 'play');
            updateIcon(overlayPlayBtn.querySelector('i'), 'play');
            clearTimeout(idleTimer);
            videoWrapper.classList.remove('user-idle');
        }
    }

    function togglePlayPause() {
        if (mainVideo.paused || mainVideo.ended) {
            mainVideo.play().then(() => {
                togglePlayState(true);
            });
        } else {
            mainVideo.pause();
            togglePlayState(false);
        }
    }

    // Bind Play Actions
    playBtn.addEventListener('click', togglePlayPause);
    overlayPlayBtn.addEventListener('click', togglePlayPause);
    mainVideo.addEventListener('click', togglePlayPause);

    // ----------------------------------------------------
    // Seeking and Skipping Controls
    // ----------------------------------------------------
    function skipVideo(seconds) {
        if (!mainVideo.src) return;
        
        mainVideo.currentTime = Math.max(0, Math.min(mainVideo.duration, mainVideo.currentTime + seconds));
        updateProgressBar();
        triggerSeekToast(seconds);
    }

    function triggerSeekToast(seconds) {
        clearTimeout(toastTimer);
        seekToast.classList.remove('active');
        
        void seekToast.offsetWidth; // Force reflow

        const isForward = seconds > 0;
        const toastIcon = seekToast.querySelector('.toast-icon');
        const toastText = seekToast.querySelector('.toast-text');

        toastText.textContent = `${isForward ? '+' : '-'}${Math.abs(seconds)}s`;
        
        if (isForward) {
            updateIcon(toastIcon, 'chevrons-right');
            seekToast.style.borderColor = 'var(--primary)';
            toastIcon.style.color = 'var(--primary)';
        } else {
            updateIcon(toastIcon, 'chevrons-left');
            seekToast.style.borderColor = '#f02fc2';
            toastIcon.style.color = '#f02fc2';
        }

        seekToast.classList.add('active');

        toastTimer = setTimeout(() => {
            seekToast.classList.remove('active');
        }, 850);
    }

    rewindBtn.addEventListener('click', () => skipVideo(-10));
    forwardBtn.addEventListener('click', () => skipVideo(10));

    // ----------------------------------------------------
    // Timeline Updates & Interactive Scrubbing
    // ----------------------------------------------------
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds === Infinity) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function updateProgressBar() {
        if (!mainVideo.duration) return;
        const percentage = (mainVideo.currentTime / mainVideo.duration) * 100;
        timelineProgress.style.width = `${percentage}%`;
        timelineHandle.style.left = `${percentage}%`;
        timeCurrent.textContent = formatTime(mainVideo.currentTime);
    }

    mainVideo.addEventListener('timeupdate', () => {
        if (!isDraggingTimeline) {
            updateProgressBar();
        }
    });

    function handleScrub(e) {
        if (!mainVideo.duration) return;
        const rect = timelineContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const position = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        
        timelineProgress.style.width = `${position * 100}%`;
        timelineHandle.style.left = `${position * 100}%`;
        
        mainVideo.currentTime = position * mainVideo.duration;
        timeCurrent.textContent = formatTime(mainVideo.currentTime);
    }

    timelineContainer.addEventListener('mousedown', (e) => {
        isDraggingTimeline = true;
        handleScrub(e);
    });

    timelineContainer.addEventListener('mousemove', (e) => {
        const rect = timelineContainer.getBoundingClientRect();
        const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        timelineHover.style.width = `${position * 100}%`;

        if (isDraggingTimeline) {
            handleScrub(e);
        }
    });

    window.addEventListener('mouseup', () => {
        isDraggingTimeline = false;
    });

    timelineContainer.addEventListener('touchstart', (e) => {
        isDraggingTimeline = true;
        handleScrub(e);
    }, { passive: true });

    timelineContainer.addEventListener('touchmove', (e) => {
        if (isDraggingTimeline) {
            handleScrub(e);
        }
    }, { passive: true });

    // ----------------------------------------------------
    // Volume Control Logic
    // ----------------------------------------------------
    let lastVolume = 1;

    function setVolume(value) {
        mainVideo.volume = value;
        volumeSlider.value = value;
        
        if (value === 0) {
            updateIcon(volumeIcon, 'volume-x');
        } else if (value < 0.4) {
            updateIcon(volumeIcon, 'volume-1');
        } else {
            updateIcon(volumeIcon, 'volume-2');
        }
    }

    function toggleMute() {
        if (mainVideo.volume > 0) {
            lastVolume = mainVideo.volume;
            setVolume(0);
        } else {
            setVolume(lastVolume);
        }
    }

    volumeSlider.addEventListener('input', (e) => {
        setVolume(parseFloat(e.target.value));
    });

    volumeBtn.addEventListener('click', toggleMute);

    // ----------------------------------------------------
    // Fullscreen API Handling
    // ----------------------------------------------------
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            videoWrapper.requestFullscreen()
                .then(() => {
                    updateIcon(fullscreenIcon, 'minimize');
                })
                .catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
        } else {
            document.exitFullscreen()
                .then(() => {
                    updateIcon(fullscreenIcon, 'maximize');
                });
        }
    }

    fullscreenBtn.addEventListener('click', toggleFullscreen);
    
    mainVideo.addEventListener('dblclick', (e) => {
        e.preventDefault();
        toggleFullscreen();
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            updateIcon(fullscreenIcon, 'maximize');
        } else {
            updateIcon(fullscreenIcon, 'minimize');
        }
    });

    // ----------------------------------------------------
    // Keyboard Shortcuts
    // ----------------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'range') return;
        if (videoWrapper.classList.contains('hidden')) return;

        switch (e.key.toLowerCase()) {
            case ' ':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'arrowleft':
                e.preventDefault();
                skipVideo(-10);
                break;
            case 'arrowright':
                e.preventDefault();
                skipVideo(10);
                break;
            case 'f':
                e.preventDefault();
                toggleFullscreen();
                break;
            case 'm':
                e.preventDefault();
                toggleMute();
                break;
        }
    });

    // ----------------------------------------------------
    // Idle Controls Auto-Hide Behavior
    // ----------------------------------------------------
    function resetIdleTimer() {
        clearTimeout(idleTimer);
        videoWrapper.classList.remove('user-idle');
        
        if (!mainVideo.paused) {
            idleTimer = setTimeout(() => {
                videoWrapper.classList.add('user-idle');
            }, 3000);
        }
    }

    ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(eventName => {
        videoWrapper.addEventListener(eventName, resetIdleTimer);
    });

    mainVideo.addEventListener('play', resetIdleTimer);
    mainVideo.addEventListener('pause', () => {
        clearTimeout(idleTimer);
        videoWrapper.classList.remove('user-idle');
    });

    // ----------------------------------------------------
    // Tauri Desktop Titlebar Actions
    // ----------------------------------------------------
    if (isTauri) {
        const appWindow = window.__TAURI__.window.getCurrentWindow();
        
        document.getElementById('winMinimizeBtn').addEventListener('click', () => {
            appWindow.minimize();
        });
        document.getElementById('winMaximizeBtn').addEventListener('click', () => {
            appWindow.toggleMaximize();
        });
        document.getElementById('winCloseBtn').addEventListener('click', () => {
            appWindow.close();
        });

        // Listen for Tauri native file drag-and-drop actions
        appWindow.onDragDropEvent((event) => {
            if (event.payload && event.payload.type === 'drop') {
                const paths = event.payload.paths;
                if (paths && paths.length > 0) {
                    loadVideoSource(paths[0], false);
                }
            }
        });
    } else {
        const winMinimizeBtn = document.getElementById('winMinimizeBtn');
        const winMaximizeBtn = document.getElementById('winMaximizeBtn');
        const winCloseBtn = document.getElementById('winCloseBtn');
        if (winMinimizeBtn) winMinimizeBtn.style.display = 'none';
        if (winMaximizeBtn) winMaximizeBtn.style.display = 'none';
        if (winCloseBtn) winCloseBtn.style.display = 'none';
    }

    // ----------------------------------------------------
    // Interactive Onboarding Tour Logic
    // ----------------------------------------------------
    const tourOverlay = document.getElementById('tourOverlay');
    const tourTooltip = document.getElementById('tourTooltip');
    const tourTitle = document.getElementById('tourTitle');
    const tourText = document.getElementById('tourText');
    const tourDotsContainer = document.getElementById('tourDots');
    const tourSkipBtn = document.getElementById('tourSkipBtn');
    const tourPrevBtn = document.getElementById('tourPrevBtn');
    const tourNextBtn = document.getElementById('tourNextBtn');

    const tourSteps = [
        {
            target: '#storagePrompt',
            title: 'Welcome to AeroPlayer!',
            text: 'Allow storage access to automatically catalog all videos in your system, or select single files manually.',
            placement: 'bottom'
        },
        {
            target: '#winPlaylistToggleBtn',
            title: 'Toggle Video Catalog',
            text: 'Click here to show or hide your collapsible video catalog drawer anytime.',
            placement: 'bottom'
        },
        {
            target: '#winStreamsBtn',
            title: 'Quick Demo Streams',
            text: 'Play high-quality demo movies instantly from our cloud servers.',
            placement: 'bottom'
        },
        {
            target: '#winShortcutsBtn',
            title: 'Keyboard Shortcuts',
            text: 'Control the player with rapid hotkeys like Space, Left/Right arrows, M, and F.',
            placement: 'bottom'
        }
    ];

    let currentTourStep = 0;

    function initTour() {
        if (!tourOverlay || !tourTooltip) return;

        tourDotsContainer.innerHTML = '';
        tourSteps.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.className = `tour-dot ${idx === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => showTourStep(idx));
            tourDotsContainer.appendChild(dot);
        });

        tourSkipBtn.addEventListener('click', endTour);
        tourPrevBtn.addEventListener('click', () => navigateTour(-1));
        tourNextBtn.addEventListener('click', () => navigateTour(1));
        if (winInfoBtn) {
            winInfoBtn.addEventListener('click', startTour);
        }

        if (localStorage.getItem('aeroplayer_tour_completed') !== 'true') {
            setTimeout(startTour, 1000);
        }
    }

    function startTour() {
        currentTourStep = 0;
        tourOverlay.classList.remove('hidden');
        tourOverlay.classList.add('visible');
        tourTooltip.classList.remove('hidden');
        tourTooltip.classList.add('visible');
        showTourStep(0);
    }

    function endTour() {
        tourOverlay.classList.remove('visible');
        tourOverlay.classList.add('hidden');
        tourTooltip.classList.remove('visible');
        tourTooltip.classList.add('hidden');
        
        document.querySelectorAll('.tour-highlighted').forEach(el => {
            el.classList.remove('tour-highlighted');
        });

        localStorage.setItem('aeroplayer_tour_completed', 'true');
    }

    function navigateTour(dir) {
        const nextStep = currentTourStep + dir;
        if (nextStep >= 0 && nextStep < tourSteps.length) {
            showTourStep(nextStep);
        } else if (nextStep >= tourSteps.length) {
            endTour();
        }
    }

    function showTourStep(stepIndex) {
        currentTourStep = stepIndex;
        const step = tourSteps[stepIndex];
        const targetElement = document.querySelector(step.target);

        document.querySelectorAll('.tour-highlighted').forEach(el => {
            el.classList.remove('tour-highlighted');
        });

        tourTitle.textContent = step.title;
        tourText.textContent = step.text;

        const dots = tourDotsContainer.querySelectorAll('.tour-dot');
        dots.forEach((dot, idx) => {
            if (idx === stepIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });

        if (stepIndex === 0) {
            tourPrevBtn.style.display = 'none';
        } else {
            tourPrevBtn.style.display = 'inline-flex';
        }

        const nextBtnSpan = tourNextBtn.querySelector('span');
        const nextBtnIcon = tourNextBtn.querySelector('i') || tourNextBtn.querySelector('svg');
        if (stepIndex === tourSteps.length - 1) {
            nextBtnSpan.textContent = 'Finish';
            if (nextBtnIcon) nextBtnIcon.style.display = 'none';
        } else {
            nextBtnSpan.textContent = 'Next';
            if (nextBtnIcon) nextBtnIcon.style.display = 'inline-block';
        }

        if (targetElement) {
            targetElement.classList.add('tour-highlighted');
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            positionTooltip(targetElement, step.placement);
        } else {
            positionTooltipCenter();
        }
    }

    function positionTooltip(target, placement) {
        const targetRect = target.getBoundingClientRect();
        
        const isHidden = tourTooltip.classList.contains('hidden');
        if (isHidden) {
            tourTooltip.classList.remove('hidden');
            tourTooltip.style.opacity = '0';
        }
        
        const tooltipRect = tourTooltip.getBoundingClientRect();
        
        if (isHidden) {
            tourTooltip.classList.add('hidden');
            tourTooltip.style.opacity = '';
        }
        
        let top = 0;
        let left = 0;
        const margin = 15;
        
        if (placement === 'bottom') {
            top = targetRect.bottom + margin;
            left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        } else if (placement === 'top') {
            top = targetRect.top - tooltipRect.height - margin;
            left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        } else if (placement === 'left') {
            top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
            left = targetRect.left - tooltipRect.width - margin;
        } else if (placement === 'right') {
            top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
            left = targetRect.right + margin;
        }

        const padding = 10;
        const maxLeft = window.innerWidth - tooltipRect.width - padding;
        const maxTop = window.innerHeight - tooltipRect.height - padding;
        
        left = Math.max(padding, Math.min(maxLeft, left));
        top = Math.max(padding, Math.min(maxTop, top));

        tourTooltip.setAttribute('data-placement', placement);
        tourTooltip.style.top = `${top}px`;
        tourTooltip.style.left = `${left}px`;
    }

    function positionTooltipCenter() {
        const tooltipRect = tourTooltip.getBoundingClientRect();
        const top = (window.innerHeight / 2) - (tooltipRect.height / 2);
        const left = (window.innerWidth / 2) - (tooltipRect.width / 2);
        
        tourTooltip.removeAttribute('data-placement');
        tourTooltip.style.top = `${top}px`;
        tourTooltip.style.left = `${left}px`;
    }

    window.addEventListener('resize', () => {
        if (tourTooltip.classList.contains('visible') && !tourTooltip.classList.contains('hidden')) {
            const step = tourSteps[currentTourStep];
            const targetElement = document.querySelector(step.target);
            if (targetElement) {
                positionTooltip(targetElement, step.placement);
            } else {
                positionTooltipCenter();
            }
        }
    });

    initTour();
});
