const YOUTUBE_BASE_VIDEO_URL = 'https://www.youtube.com/watch?v=';
const IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
const BUFFERING_TIMEOUT = 3500;
const CHANNELS_ENDPOINT = '/api/channels';
const CURRENT_VIDEO_ENDPOINT = '/api/current-video';
const SUBMIT_VIDEO_ENDPOINT = '/api/submit-list';
const INVALIDATE_VIDEO_ENDPOINT = '/api/invalidate-video';
const VOLUME_STEPS = 5;
const VOLUME_BAR_TIMEOUT = 2000;
const CHANNEL_NAME_TIMEOUT = 3000;
const INTERVAL_CHECK_MS = 1000;

const ICONS = {
  power: '/assets/icons/power.svg',
  volume_muted: '/assets/icons/volume_muted.svg',
  volume_high: '/assets/icons/volume_high.svg',
  expand: '/assets/icons/expand.svg',
  contract: '/assets/icons/contract.svg'
};

const loadYouTubeAPI = (onReady) => {
  const tag = document.createElement('script');
  tag.src = IFRAME_API_URL;
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = onReady;
};

const initializePlayer = (playerElementId, onReady, onStateChange, onError) => {
  return new YT.Player(playerElementId, {
    width: '100%',
    height: '100%',
    autoplay: 1,
    events: { onReady, onStateChange, onError },
    playerVars: {
      mute: 1,
      controls: 0,
      modestbranding: 1,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      rel: 0,
      enablejsapi: 1,
      autoplay: 1,
      showinfo: 0
    }
  });
};

const fetchChannels = async () => {
  const res = await fetch(CHANNELS_ENDPOINT);
  const data = await res.json();
  return data.channels || [];
};

const fetchCurrentVideo = async (channelId, videoId) => {
  const url = `${CURRENT_VIDEO_ENDPOINT}?channel-id=${channelId}${
    videoId ? `&video-id=${videoId}` : ''
  }`;
  const res = await fetch(url);
  const data = await res.json();
  return data.video || null;
};

const handleUnavailableVideo = async (state) => {
  const url = `${INVALIDATE_VIDEO_ENDPOINT}?video-id=${state.currentVideo.id}`;
  const res = await fetch(url, {
    method: 'DELETE'
  });
  const data = await res.json();

  if (data.success) {
    const { newChannel, newVideo } = await changeChannel(state, 0);
    state.currentChannel = newChannel;
    state.currentVideo = newVideo;
  }
};

const showBuffering = () => {
  document.querySelector('#buffer-gif')?.classList.add('active');
};

const hideBuffering = () => {
  document.querySelector('#buffer-gif')?.classList.remove('active');
};

const deactiveBuffering = (state) => {
  const { player } = state;
  const shouldUnmute = state.isInteracted && !state.isMuted;

  // make sure that the player is muted so that it does not play sound
  // when buffering is active
  player.mute();

  setTimeout(() => {
    hideBuffering();
    if (shouldUnmute) {
      player.unMute();
      state.isMuted = false;
    }
    setControlIcon('control-power', ICONS.power, false);
  }, BUFFERING_TIMEOUT);
};

const setControlIcon = (iconId, iconSrc, isActive) => {
  const iconElement = document.querySelector(`#${iconId} .control-icon`);
  if (iconElement) {
    iconElement.src = iconSrc;
    iconElement.classList.toggle('red', isActive);
  }
};

const toggleMute = (player, isMuted) => {
  player[isMuted ? 'unMute' : 'mute']();
  setControlIcon(
    'control-mute',
    isMuted ? ICONS.volume_high : ICONS.volume_muted,
    !isMuted
  );
  return !isMuted;
};

const updateVideoLink = (state) => {
  const videoLinkContainer = document.querySelector('#video-link');
  const videoLinkTitle = document.querySelector('#video-link-title');

  if (state.currentVideoName) {
    videoLinkTitle.innerHTML = state.currentVideoName;
    videoLinkContainer.classList.add('active');
  } else {
    videoLinkContainer.classList.remove('active');
  }
};

const updateVolumeBar = (currentVolume) => {
  const volumeBar = document.querySelector('#volume-bar');
  if (!volumeBar) return;

  const maxBars = 100 / VOLUME_STEPS;
  const currentStep = Math.ceil(currentVolume / VOLUME_STEPS);

  volumeBar.classList.add('active');
  volumeBar.innerHTML = Array.from(
    { length: maxBars },
    (_, index) =>
      `<div class="volume-bar-step ${
        index < currentStep ? 'active' : ''
      }"></div>`
  ).join('');

  setTimeout(() => volumeBar.classList.remove('active'), VOLUME_BAR_TIMEOUT);
};

const updateChannelList = (state, channels) => {
  const channelList = document.querySelector('#channel-list');
  if (!channelList) return;

  const channelListItems = channels.map((channel) => {
    const channelListItem = document.createElement('div');
    channelListItem.classList.add('channel-list-item');

    if (channel.id === state.currentChannel.id) {
      channelListItem.classList.add('active');
    }

    channelListItem.innerHTML = `${channel.id.toString().padStart(2, '0')} - ${
      channel.name
    }`;
    channelListItem.addEventListener('click', async () => {
      const { newChannel, newVideo } = await jumpToChannel(state, channel.id);

      state.currentChannel = newChannel;
      state.currentVideo = newVideo;
      updateChannelName(newChannel);
    });
    return channelListItem;
  });

  channelList.innerHTML = '';
  channelList.append(...channelListItems);
};

const toggleFullscreen = (state) => {
  const playerElement = document.body;

  if (state.isFullscreen) {
    document.exitFullscreen();
    state.isFullscreen = false;
  } else {
    const requestFullScreen =
      playerElement.requestFullscreen ||
      playerElement.mozRequestFullScreen ||
      playerElement.webkitRequestFullScreen ||
      playerElement.msRequestFullscreen;
    if (requestFullScreen) {
      requestFullScreen.call(playerElement);
    }
    state.isFullscreen = true;
  }
};

const toggleControlGroup = (isMinimized) => {
  const controlGroup = document.querySelector('#controls');
  const minimizeIcon = document.querySelector(
    '#control-minimize .control-icon'
  );

  isMinimized = !isMinimized;
  controlGroup.classList.toggle('minimized', isMinimized);
  minimizeIcon.src = isMinimized ? ICONS.expand : ICONS.contract;

  return isMinimized;
};

const updateChannelName = (channel) => {
  const channelId = channel.id.toString().padStart(2, '0');
  const channelName = `${channelId} - ${channel.name}`;
  const channelNameElement = document.querySelector('#channel-name');
  if (channelNameElement) {
    channelNameElement.innerHTML = channelName;
    channelNameElement.classList.add('active');

    setTimeout(() => {
      channelNameElement.classList.remove('active');
    }, CHANNEL_NAME_TIMEOUT);
  }
};

const togglePlayPause = (player, isPlaying) => {
  isPlaying ? player.pauseVideo() : player.playVideo();
  setControlIcon('control-power', ICONS.power, !isPlaying);
  return !isPlaying;
};

// Switch to the next or previous channel
const changeChannel = async (state, offset) => {
  const { player, channels, currentChannel } = state;
  const currentIndex = channels.findIndex(
    (channel) => channel.id === currentChannel.id
  );
  const newIndex = (currentIndex + offset + channels.length) % channels.length;
  const newChannel = channels[newIndex];
  const newVideo = await fetchCurrentVideo(newChannel.id);
  if (newVideo) {
    const videoId = newVideo.id;
    if (videoId) {
      const shouldUnmute = state.isInteracted && !state.isMuted;
      player.cueVideoById({ videoId, startSeconds: newVideo.sectionStart });
      player.mute();
      player.playVideo();
      if (shouldUnmute) {
        player.unMute();
        state.isMuted = false;
      }
    }
  }
  return { newChannel, newVideo };
};

const jumpToChannel = async (state, channelId) => {
  const { player, channels } = state;
  const newChannel = channels.find((channel) => channel.id === channelId);
  const newVideo = await fetchCurrentVideo(newChannel.id);
  if (newVideo) {
    const videoId = newVideo.id;
    if (videoId) {
      const shouldUnmute = state.isInteracted && !state.isMuted;
      player.cueVideoById({ videoId, startSeconds: newVideo.sectionStart });
      player.mute();
      player.playVideo();
      if (shouldUnmute) {
        player.unMute();
        state.isMuted = false;
      }
    }
  }
  return { newChannel, newVideo };
};

const closeInfoModal = () => {
  const infoPopup = document.querySelector('#info-modal-container');
  infoPopup.classList.remove('active');
};

const toggleInfoModal = () => {
  const infoPopup = document.querySelector('#info-modal-container');
  infoPopup.classList.toggle('active');

  infoPopup.addEventListener('click', (event) => {
    if (event.target === infoPopup) {
      closeInfoModal();
    }
  });
};

const closeSettingsModal = () => {
  const settingsPopup = document.querySelector('#settings-modal-container');
  settingsPopup.classList.remove('active');
};

const toggleSettingsModal = () => {
  const settingsPopup = document.querySelector('#settings-modal-container');
  settingsPopup.classList.toggle('active');

  settingsPopup.addEventListener('click', (event) => {
    if (event.target === settingsPopup) {
      closeSettingsModal();
    }
  });
};

const submitVideoLink = async () => {
  const videoListInput = document.querySelector('#video-list-input');
  const videoListUrl = videoListInput.value;

  console.log(videoListUrl);

  const res = await fetch(SUBMIT_VIDEO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ videoListUrl })
  });
  const data = await res.json();
  if (data.success) {
    console.log('Video list submitted successfully');

    videoListInput.value = '';
    closeSettingsModal();
    location.reload();
  }
};

const fetchConfig = async () => {
  try {
    const response = await fetch('/api/config');
    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Failed to fetch config:', error);
  }
};

const updateUIForReadOnlyMode = (state) => {
  submitButton = document.querySelector('#video-list-submit');
  videoListInput = document.querySelector('#video-list-input');
  if (state.readonly) {
    submitButton.disabled = true;
    submitButton.style.opacity = '0.5';
    videoListInput.disabled = true;
    videoListInput.style.opacity = '0.5';
    videoListInput.placeholder = 'Application is in readonly mode';
  } else {
    submitButton.disabled = false;
    submitButton.style.opacity = '1';
    videoListInput.disabled = false;
    videoListInput.style.opacity = '1';
    videoListInput.placeholder = 'Enter video list URL';
  }
};

const displayMessage = (message, title = ' ') => {
  const messageModal = document.querySelector('#message-modal');
  const messageTitle = document.querySelector('#message-modal-title-content');

  if (title) {
    messageTitle.innerHTML = title;
  }

  const messageContent = document.querySelector('#message-modal-content');
  messageContent.innerHTML = message;

  messageModal.classList.add('active');
};

const closeMessageModal = () => {
  const messageModal = document.querySelector('#message-modal');
  messageModal.classList.remove('active');
};

const addEventListeners = (state) => {
  // Add Event Listeners for all buttons
  const controls = {
    power: () => {
      state.isPlaying = togglePlayPause(state.player, state.isPlaying);
    },
    mute: () => {
      state.isMuted = toggleMute(state.player, state.isMuted);
    },
    chup: async () => {
      const { newChannel, newVideo } = await changeChannel(state, 1);
      state.currentChannel = newChannel;
      state.currentVideo = newVideo;
      updateChannelName(newChannel);
    },
    chdown: async () => {
      const { newChannel, newVideo } = await changeChannel(state, -1);
      state.currentChannel = newChannel;
      state.currentVideo = newVideo;
      updateChannelName(newChannel);
    },
    volup: () => {
      const currentVolume = state.player.getVolume();
      const newVolume = Math.min(currentVolume + VOLUME_STEPS, 100);
      state.player.setVolume(newVolume);
      updateVolumeBar(newVolume);
      state.player.unMute();
      state.isMuted = false;
    },
    voldown: () => {
      const currentVolume = state.player.getVolume();
      const newVolume = Math.max(currentVolume - VOLUME_STEPS, 0);
      state.player.setVolume(newVolume);
      updateVolumeBar(newVolume);
      state.player.unMute();
      state.isMuted = false;
    },
    fullscreen: () => {
      toggleFullscreen(state);
    },
    minimize: () => {
      state.isControlGroupMinimized = toggleControlGroup(
        state.isControlGroupMinimized
      );
    },
    info: () => {
      toggleInfoModal();
    },
    settings: () => {
      toggleSettingsModal();
    }
  };

  for (const [control, handler] of Object.entries(controls)) {
    document
      .querySelector(`#control-${control}`)
      ?.addEventListener('click', () => {
        handler();
        state.isInteracted = true;
      });
  }

  // other events
  document
    .querySelector('#info-modal-close-button')
    .addEventListener('click', () => {
      closeInfoModal();
    });

  document
    .querySelector('#settings-modal-close-button')
    .addEventListener('click', () => {
      closeSettingsModal();
    });

  document
    .querySelector('#message-modal-close-button')
    .addEventListener('click', () => {
      closeMessageModal();
    });

  document.querySelector('#video-link').addEventListener('click', () => {
    window.open(YOUTUBE_BASE_VIDEO_URL + state.currentVideo.id, '_blank');
  });

  document.querySelector('#video-list-submit').addEventListener('click', () => {
    submitVideoLink();
  });

  document.addEventListener('keydown', (event) => {
    switch (event.key) {
      case 'ArrowLeft':
        // Change to the previous channel
        changeChannel(state, -1).then(({ newChannel, newVideo }) => {
          state.currentChannel = newChannel;
          state.currentVideo = newVideo;
          updateChannelName(newChannel);
        });
        break;

      case 'ArrowRight':
        // Change to the next channel
        changeChannel(state, 1).then(({ newChannel, newVideo }) => {
          state.currentChannel = newChannel;
          state.currentVideo = newVideo;
          updateChannelName(newChannel);
        });
        break;

      case 'ArrowUp':
        // Increase volume
        const currentVolume = state.player.getVolume();
        const newVolumeUp = Math.min(currentVolume + VOLUME_STEPS, 100);
        state.player.setVolume(newVolumeUp);
        updateVolumeBar(newVolumeUp);
        state.player.unMute();
        state.isMuted = false;
        break;

      case 'ArrowDown':
        // Decrease volume
        const currentVolumeDown = state.player.getVolume();
        const newVolumeDown = Math.max(currentVolumeDown - VOLUME_STEPS, 0);
        state.player.setVolume(newVolumeDown);
        updateVolumeBar(newVolumeDown);
        state.player.unMute();
        state.isMuted = false;
        break;

      case 'm':
        // Control mute
        state.isMuted = toggleMute(state.player, state.isMuted);
        break;

      case ' ':
        // Toggle power (play/pause)
        event.preventDefault(); // Prevent scrolling when pressing space
        state.isPlaying = togglePlayPause(state.player, state.isPlaying);
        break;
    }
  });

  document.addEventListener('DOMContentLoaded', fetchConfig);
};

const initApp = async (playerElementId) => {
  const channels = await fetchChannels();

  if (channels.length === 0) {
    displayMessage('No channels available.');
    return;
  }

  const randomChannel = channels[Math.floor(Math.random() * channels.length)];

  const state = {
    player: null,
    isPlaying: false,
    isMuted: true,
    isFullscreen: false,
    isControlGroupMinimized: false,
    currentChannel: randomChannel,
    currentVideo: null,
    channels,
    isInteracted: false,
    currentVideoName: '',
    readonly: false
  };

  addEventListeners(state);
  fetchConfig().then((config) => {
    state.readonly = config.readonly;
    updateUIForReadOnlyMode(state);
  });

  const onReady = async () => {
    const initialVideo = await fetchCurrentVideo(state.currentChannel.id);
    if (initialVideo) {
      const videoId = initialVideo.id;
      if (videoId) {
        state.player.cueVideoById({
          videoId,
          startSeconds: initialVideo.sectionStart
        });
        state.player.playVideo();
        state.currentVideo = initialVideo;
      }
    }
  };

  const onStateChange = ({ target, data }) => {
    state.isPlaying = data === YT.PlayerState.PLAYING;
    state.isMuted = target.isMuted();
    state.currentVideoName = target.getVideoData().title;

    updateVideoLink(state);
    updateChannelList(state, channels);

    if (state.isMuted) {
      setControlIcon('control-mute', ICONS.volume_muted, true);
    }

    if (
      (data === YT.PlayerState.PLAYING || data === YT.PlayerState.ENDED) &&
      state.currentVideo
    ) {
      deactiveBuffering(state);

      const intervalId = setInterval(async () => {
        const currentTime = state.player.getCurrentTime();

        if (
          currentTime >= state.currentVideo.sectionEnd ||
          data === YT.PlayerState.ENDED
        ) {
          clearInterval(intervalId);
          const { newChannel, newVideo } = await changeChannel(state, 0);
          state.currentChannel = newChannel;
          state.currentVideo = newVideo;
        }
      }, INTERVAL_CHECK_MS);
    } else if (
      data === YT.PlayerState.CUED ||
      data === YT.PlayerState.UNSTARTED
    ) {
      state.player.playVideo();
    } else {
      showBuffering();

      setControlIcon('control-power', ICONS.power, true);
    }
  };

  const onError = ({ data: errorCode }) => {
    switch (errorCode) {
      case 100:
        console.error(
          'Error code:',
          errorCode,
          'Video is unavailable: removed or marked as private.'
        );
        handleUnavailableVideo(state);
        break;
      case 101:
      case 150:
        console.error('Error code:', errorCode, 'Video cannot be embedded.');
        handleUnavailableVideo(state);
        break;
      default:
        console.error(
          'Error code:',
          errorCode,
          'An unknown error occurred with the video.'
        );
    }
  };

  loadYouTubeAPI(() => {
    state.player = initializePlayer(
      playerElementId,
      onReady,
      onStateChange,
      onError
    );
  });
};

initApp('player');
