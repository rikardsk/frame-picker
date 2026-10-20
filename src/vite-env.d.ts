/// <reference types="vite/client" />

interface Window {
  YT?: {
    Player: new (element: HTMLElement | string, options: any) => any;
  };
  onYouTubeIframeAPIReady?: () => void;
}
