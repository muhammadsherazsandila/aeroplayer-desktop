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
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const videoWrapper = document.getElementById('videoWrapper');
    const videoOverlay = document.getElementById('videoOverlay');
    const overlayPlayBtn = document.getElementById('overlayPlayBtn');
    const seekToast = document.getElementById('seekToast');
    const demoButtons = document.querySelectorAll('.demo-select-btn');

    // State Variables
    let isDraggingTimeline = false;
    let idleTimer = null;
    let toastTimer = null;

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
        dropZone.classList.add('hidden');
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
        dropZone.classList.remove('hidden');
        // Revoke object URL to free up browser memory if applicable
        if (mainVideo.src.startsWith('blob:')) {
            URL.revokeObjectURL(mainVideo.src);
        }
    }

    // ----------------------------------------------------
    // Dropzone File Selectors
    // ----------------------------------------------------
    // Click dropzone to trigger native file search
    dropZone.addEventListener('click', (e) => {
        if (e.target.id === 'browseBtn' || browseBtn.contains(e.target)) return; // Prevent double trigger
        fileInput.click();
    });

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            loadVideoSource(e.target.files[0], true);
        }
    });

    // Drag-and-drop mechanics
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('video/')) {
                loadVideoSource(file, true);
            }
        }
    });

    // Demo Video Selectors
    demoButtons.forEach(button => {
        button.addEventListener('click', () => {
            const videoUrl = button.getAttribute('data-url');
            loadVideoSource(videoUrl, false);
        });
    });

    ejectBtn.addEventListener('click', ejectVideo);

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
        // Clear existing toast animations
        clearTimeout(toastTimer);
        seekToast.classList.remove('active');
        
        // Force reflow to restart transition
        void seekToast.offsetWidth;

        // Set direction details
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

        // Display toast
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

    // Seek Timeline Scrubbing Setup
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
        // Show hover preview
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

    // Touch events for mobile scrub support
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
    
    // Double click video screen to toggle fullscreen
    mainVideo.addEventListener('dblclick', (e) => {
        e.preventDefault();
        toggleFullscreen();
    });

    // Keep fullscreen button state aligned with ESC / system exiting fullscreen
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
        // If file input or sliders have focused and keys might interfere, prevent shortcut
        if (document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'range') return;
        
        // Active video is needed to trigger keyboard mappings
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

    // Reset idle timer on actions
    ['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach(eventName => {
        videoWrapper.addEventListener(eventName, resetIdleTimer);
    });

    mainVideo.addEventListener('play', resetIdleTimer);
    mainVideo.addEventListener('pause', () => {
        clearTimeout(idleTimer);
        videoWrapper.classList.remove('user-idle');
    });

    // ----------------------------------------------------
    // Tauri Desktop Shell Integrations
    // ----------------------------------------------------
    // ----------------------------------------------------
    // Tauri Desktop Shell Integrations
    // ----------------------------------------------------
    if (isTauri) {
        const appWindow = window.__TAURI__.window.getCurrentWindow();
        
        // Custom Titlebar Operations
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
        // In browser mode, hide desktop-only controls but keep the custom titlebar and info button
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
    const winInfoBtn = document.getElementById('winInfoBtn');

    const tourSteps = [
        {
            target: '#sidebarHeader',
            title: 'Welcome to AeroPlayer!',
            text: 'Experience your offline & online videos in a highly polished, glassmorphic layout. Let\'s show you around!',
            placement: 'bottom'
        },
        {
            target: '#playerCard',
            title: 'Your Video Canvas',
            text: 'Drag & drop any video file directly here, or click to browse. The UI dynamically accommodates and optimizes the viewport.',
            placement: 'right'
        },
        {
            target: '#sidebarDemoCard',
            title: 'Quick Demo Streams',
            text: 'Don\'t have a video file ready? Instantly play high-quality cloud media streams with a single click.',
            placement: 'left'
        },
        {
            target: '#sidebarShortcutsCard',
            title: 'Keyboard Shortcuts',
            text: 'Control playback like a pro! Use Space to play/pause, Left/Right arrows to skip, M to mute, and F for full screen.',
            placement: 'left'
        }
    ];

    let currentTourStep = 0;

    function initTour() {
        if (!tourOverlay || !tourTooltip) return;

        // Build dots
        tourDotsContainer.innerHTML = '';
        tourSteps.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.className = `tour-dot ${idx === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => showTourStep(idx));
            tourDotsContainer.appendChild(dot);
        });

        // Event listeners
        tourSkipBtn.addEventListener('click', endTour);
        tourPrevBtn.addEventListener('click', () => navigateTour(-1));
        tourNextBtn.addEventListener('click', () => navigateTour(1));
        if (winInfoBtn) {
            winInfoBtn.addEventListener('click', startTour);
        }

        // Auto-start if not completed before
        if (localStorage.getItem('aeroplayer_tour_completed') !== 'true') {
            // Give a tiny delay for everything to settle/render
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
        
        // Remove highlight from any active element
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

        // Remove active highlights
        document.querySelectorAll('.tour-highlighted').forEach(el => {
            el.classList.remove('tour-highlighted');
        });

        // Update Text
        tourTitle.textContent = step.title;
        tourText.textContent = step.text;

        // Update Dots
        const dots = tourDotsContainer.querySelectorAll('.tour-dot');
        dots.forEach((dot, idx) => {
            if (idx === stepIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });

        // Update Buttons
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
            
            // Scroll to view if necessary
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

            // Position tooltip
            positionTooltip(targetElement, step.placement);
        } else {
            // Element not found (fallback to center)
            positionTooltipCenter();
        }
    }

    function positionTooltip(target, placement) {
        const targetRect = target.getBoundingClientRect();
        
        // Temporarily reveal tooltip transparently if not displayed to get accurate client rects
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
        
        // Calculate coordinates based on placement
        const margin = 15; // gap between target and tooltip
        
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

        // Bound checking to ensure tooltip remains inside viewport
        const padding = 10;
        const maxLeft = window.innerWidth - tooltipRect.width - padding;
        const maxTop = window.innerHeight - tooltipRect.height - padding;
        
        left = Math.max(padding, Math.min(maxLeft, left));
        top = Math.max(padding, Math.min(maxTop, top));

        // Update tooltip style
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

    // Reposition tooltip on window resize
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

    // Initialize the tour
    initTour();
});
