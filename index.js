function main() {
  // Create header
  const header = document.createElement('header');
  header.className = 'app-header';
  const headerContent = document.createElement('div');
  headerContent.className = 'header-content';
  const logo = document.createElement('h1');
  logo.className = 'logo';
  logo.textContent = '🤖 RITA lite';

  const staticHeaderLinks = [];
  let dynamicHeaderLinks = ['styles.css'];
  if (window.location.protocol !== 'file:') {
    dynamicHeaderLinks = dynamicHeaderLinks.map((src) => {
      return 'https://gianlucabobbioscale.github.io/RITA-lite/' + src;
    });
  }
  [...staticHeaderLinks, ...dynamicHeaderLinks].forEach((src) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = src;
    document.head.appendChild(link);
  });

  headerContent.appendChild(logo);
  header.appendChild(headerContent);
  document.body.appendChild(header);

  // Add warning message about keeping tab active
  const warningMessage = document.createElement('div');
  warningMessage.className = 'warning-message';
  warningMessage.textContent =
    '⚠️ Please keep this tab active while processing videos to ensure optimal performance.';
  document.body.appendChild(warningMessage);

  // Create user specs div
  const userSpecs = document.createElement('div');
  userSpecs.className = 'user-specs';
  userSpecs.id = 'userSpecs';
  document.body.appendChild(userSpecs);

  // Create browser landing div
  const browserLanding = document.createElement('div');
  browserLanding.id = 'browserLanding';
  browserLanding.className = 'browser-landing';
  browserLanding.style.display = 'none';
  const browserLogo = document.createElement('h1');
  browserLogo.className = 'logo';
  browserLogo.textContent = 'RITA-lite';
  const landingContent = document.createElement('div');
  landingContent.className = 'landing-content';
  const h2 = document.createElement('h2');
  h2.textContent = 'Browser Not Supported';
  const p1 = document.createElement('p');
  p1.textContent =
    'This application requires Firefox for optimal performance and compatibility.';
  const p2 = document.createElement('p');
  p2.textContent =
    'Please download and use Firefox to access this application.';
  const a = document.createElement('a');
  a.href = 'https://www.mozilla.org/firefox/new/';
  a.target = '_blank';
  a.className = 'landing-button';
  a.textContent = 'Download Firefox';
  landingContent.appendChild(h2);
  landingContent.appendChild(p1);
  landingContent.appendChild(p2);
  landingContent.appendChild(a);
  browserLanding.appendChild(browserLogo);
  browserLanding.appendChild(landingContent);
  document.body.appendChild(browserLanding);

  // Create main content div
  const mainContent = document.createElement('div');
  mainContent.id = 'mainContent';

  // Create upload videos section
  const uploadSection = document.createElement('div');
  uploadSection.className = 'section';
  const uploadTitle = document.createElement('div');
  uploadTitle.className = 'section-title';
  uploadTitle.textContent = 'Upload Videos';
  const controls = document.createElement('div');
  controls.className = 'controls';
  const controlsLeft = document.createElement('div');
  controlsLeft.className = 'controls-left';
  const label = document.createElement('label');
  label.htmlFor = 'videoInput';
  label.className = 'custom-file-input';
  label.textContent = 'Select Videos';
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'videoInput';
  input.multiple = true;
  input.accept = '.insv';
  const button = document.createElement('button');
  button.id = 'pairVideos';
  button.textContent = 'Pair Selected Videos';
  controlsLeft.appendChild(label);
  controlsLeft.appendChild(input);
  controlsLeft.appendChild(button);
  controls.appendChild(controlsLeft);

  const playbackControl = document.createElement('div');
  playbackControl.className = 'playback-control';
  const playbackHeader = document.createElement('div');
  playbackHeader.className = 'playback-header';
  const playbackLabel = document.createElement('label');
  playbackLabel.htmlFor = 'playbackRate';
  playbackLabel.textContent = 'Playback Rate:';
  const playbackRateValue = document.createElement('span');
  playbackRateValue.id = 'playbackRateValue';
  playbackRateValue.textContent = '6x';
  playbackHeader.appendChild(playbackLabel);
  playbackHeader.appendChild(playbackRateValue);
  const playbackInput = document.createElement('input');
  playbackInput.type = 'range';
  playbackInput.id = 'playbackRate';
  playbackInput.min = '1';
  playbackInput.max = '16';
  playbackInput.step = '0.5';
  playbackInput.value = '6';
  playbackControl.appendChild(playbackHeader);
  playbackControl.appendChild(playbackInput);
  controls.appendChild(playbackControl);

  uploadSection.appendChild(uploadTitle);
  uploadSection.appendChild(controls);
  const videoContainer = document.createElement('div');
  videoContainer.className = 'video-container';
  videoContainer.id = 'videoContainer';
  uploadSection.appendChild(videoContainer);
  mainContent.appendChild(uploadSection);

  // Create pair videos section
  const pairSection = document.createElement('div');
  pairSection.className = 'section';
  pairSection.id = 'pairSection';
  pairSection.style.display = 'none';
  const pairTitle = document.createElement('div');
  pairTitle.className = 'section-title';
  pairTitle.textContent = 'Paired Videos';
  const pairCard = document.createElement('div');
  pairCard.className = 'pair-card';
  pairCard.id = 'pairCard';
  pairCard.style.display = 'none';
  const videoPair = document.createElement('div');
  videoPair.className = 'pair-videos';
  videoPair.id = 'videoPair';
  pairCard.appendChild(videoPair);
  pairSection.appendChild(pairTitle);
  pairSection.appendChild(pairCard);
  mainContent.appendChild(pairSection);

  // Create process paired videos section
  const processSection = document.createElement('div');
  processSection.className = 'section';
  processSection.id = 'processSection';
  processSection.style.display = 'none';
  const processTitle = document.createElement('div');
  processTitle.className = 'section-title';
  processTitle.textContent = 'Process Paired Videos';
  const processVideoPair = document.createElement('div');
  processVideoPair.className = 'video-pair';
  processVideoPair.id = 'videoPair';
  processSection.appendChild(processTitle);
  processSection.appendChild(processVideoPair);
  mainContent.appendChild(processSection);

  document.body.appendChild(mainContent);

  const timestamp = new Date().getTime();

  // Add script elements
  const scripts = [
    'https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/index.min.js',
    'https://cdn.jsdelivr.net/gh/antimatter15/whammy/whammy.js',
  ];
  let dynamicScripts = [
    'js/videoProcessing.js',
    'js/uiHandlers.js',
    'js/main.js',
  ];

  // if scripts is run locally, use the local scripts
  if (window.location.protocol !== 'file:') {
    dynamicScripts = dynamicScripts.map((src) => {
      return (
        'https://gianlucabobbioscale.github.io/RITA-lite/' +
        src +
        '?v=' +
        timestamp
      );
    });
  }
  scripts.forEach((src) => {
    const script = document.createElement('script');
    script.src = src;
    document.body.appendChild(script);
  });
  dynamicScripts.forEach((src) => {
    const script = document.createElement('script');
    script.src = src;
    document.body.appendChild(script);
  });
}

main();
