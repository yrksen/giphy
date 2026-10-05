import { useEffect } from 'react';
const faviconImage = 'https://i.imgur.com/vUiVqow.png?direct';

export function FaviconSetter() {
  useEffect(() => {
    // Set favicon
    let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconImage;

    // Set apple touch icon
    let appleLink: HTMLLinkElement | null = document.querySelector("link[rel~='apple-touch-icon']");
    if (!appleLink) {
      appleLink = document.createElement('link');
      appleLink.rel = 'apple-touch-icon';
      document.head.appendChild(appleLink);
    }
    appleLink.href = faviconImage;
  }, []);

  return null;
}